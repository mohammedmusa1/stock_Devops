import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
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

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const secure = this.config.get('COOKIE_SECURE') === 'true';
    const opts = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
    res.cookie('accessToken', accessToken, { ...opts, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...opts, maxAge: 7 * 24 * 60 * 60 * 1000 });
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const data = await this.auth.register(dto);
    return { success: true, data };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.headers['x-forwarded-for']?.toString() ?? req.ip;
    const result = await this.auth.login(dto, ip);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const data = await this.auth.verifyEmail(dto);
    return { success: true, data };
  }

  @Post('verify-email/token')
  async verifyEmailToken(@Body() dto: VerifyEmailTokenDto) {
    const data = await this.auth.verifyEmailByToken(dto);
    return { success: true, data };
  }

  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    const data = await this.auth.resendVerification(dto);
    return { success: true, data };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const data = await this.auth.forgotPassword(dto);
    return { success: true, data };
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const data = await this.auth.resetPassword(dto);
    return { success: true, data };
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.auth.changePassword(req.user.id, dto);
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return { success: true, data };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
    if (!token) return { success: false, message: 'Refresh token required' };
    const result = await this.auth.refresh(token);
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE') === 'true',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    return { success: true, data: result };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refreshToken;
    if (token) await this.auth.logout(token);
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return { success: true, message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: Request & { user: { id: string } }) {
    const profile = await this.auth.getProfile(req.user.id);
    return { success: true, data: profile };
  }
}
