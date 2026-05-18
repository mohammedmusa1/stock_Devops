import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  VerifyEmailTokenDto,
  ChangePasswordDto,
  ResendVerificationDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
    private notifications: NotificationsService,
    private otp: OtpService,
    private sessions: SessionService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: 'PENDING_VERIFICATION',
        emailVerified: false,
        wallet: { create: { balance: 0, currency: 'INR' } },
      },
    });

    try {
      await this.sendVerificationOtp(user.id, email, 'signup');
    } catch (error) {
      await this.prisma.user.delete({ where: { id: user.id } });
      throw error;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      requiresVerification: true,
      message: 'Account created. Enter the 6-digit code sent to your email.',
    };
  }

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended. Contact support.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    if (!user.emailVerified) {
      const cooldownSeconds = await this.otp.getResendCooldownRemaining(user.email);

      if (cooldownSeconds === 0) {
        await this.sendVerificationOtp(user.id, user.email, 'login');
      }

      throw new UnauthorizedException({
        message: 'Email not verified. Enter the OTP sent to your inbox.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), status: 'ACTIVE' },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    const refreshExpires = new Date();
    refreshExpires.setDate(refreshExpires.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: refreshExpires,
      },
    });

    await this.sessions.createSession(user.id, tokens.refreshToken);

    await this.mail.sendLoginAlert(user.email, ip);
    await this.notifications.create(
      user.id,
      'New sign-in detected',
      `Your account was accessed${ip ? ` from ${ip}` : ''}.`,
      'security',
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const userId = await this.otp.verifyEmailOtp(dto.email, dto.otp);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { emailVerified: true, status: 'ACTIVE' },
      });
      await tx.verificationToken.deleteMany({ where: { userId } });
    });

    await this.notifications.create(
      userId,
      'Email verified',
      'Your account is active. You can now trade on Stock AI.',
      'account',
    );

    return { message: 'Email verified successfully. You may sign in now.' };
  }

  /** Legacy token link verification */
  async verifyEmailByToken(dto: VerifyEmailTokenDto) {
    const record = await this.prisma.verificationToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, status: 'ACTIVE' },
      });
      await tx.verificationToken.delete({ where: { id: record.id } });
    });

    return { message: 'Email verified successfully. You may sign in now.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      return { message: 'If that email exists, a new OTP was sent.', cooldownSeconds: 0 };
    }
    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const cooldownSeconds = await this.otp.getResendCooldownRemaining(email);
    if (cooldownSeconds > 0) {
      return {
        message: `Wait ${cooldownSeconds}s before requesting another code.`,
        cooldownSeconds,
      };
    }

    await this.sendVerificationOtp(user.id, email, 'resend');
    const newCooldown = await this.otp.getResendCooldownRemaining(email);

    return {
      message: 'A new 6-digit code was sent to your email.',
      cooldownSeconds: newCooldown || 60,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (user) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });
      await this.mail.sendPasswordResetEmail(user.email, token);
    }

    return { message: 'If that email exists, a password reset link was sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { revoked: true },
      }),
    ]);

    await this.sessions.revokeAllUserSessions(record.userId);

    await this.notifications.create(
      record.userId,
      'Password changed',
      'Your password was reset. All sessions were signed out.',
      'security',
    );

    return { message: 'Password updated. Please sign in with your new password.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
    await this.sessions.revokeAllUserSessions(userId);

    await this.notifications.create(
      userId,
      'Password updated',
      'Your password was changed successfully.',
      'security',
    );

    return { message: 'Password changed. Please sign in again.' };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException('Token revoked or expired');

    const accessToken = await this.jwt.signAsync({
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
    });

    return { accessToken };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });
    await this.sessions.revokeByRefreshToken(refreshToken);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        avatarUrl: true,
        emailVerified: true,
        mfaEnabled: true,
        status: true,
        createdAt: true,
        wallet: { select: { balance: true, lockedBalance: true, currency: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async sendVerificationOtp(userId: string, email: string, source: 'signup' | 'login' | 'resend') {
    const code = await this.otp.issueEmailVerificationOtp(email, userId);
    try {
      this.logger.log(`Sending verification OTP for ${email} from ${source}`);
      await this.mail.sendOtpEmail(email, code);
      this.logger.log(`Verification OTP delivered for ${email} from ${source}`);
    } catch (error) {
      await this.otp.clearEmailVerificationState(email);
      this.logger.error(`Verification OTP delivery failed for ${email} from ${source}`, error as Error);
      throw error;
    }
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, email, role });
    const refreshToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );
    return { accessToken, refreshToken };
  }
}
