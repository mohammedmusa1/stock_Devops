import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly resendApiKey: string | null;
  private readonly emailFrom: string;

  constructor(private config: ConfigService) {
    this.resendApiKey = this.config.get<string>('RESEND_API_KEY')?.trim() || null;
    this.emailFrom = this.config.get<string>('EMAIL_FROM')?.trim() || 'onboarding@resend.dev';
    this.resend = this.resendApiKey ? new Resend(this.resendApiKey) : null;
  }

  onModuleInit() {
    this.logger.log(
      `Email config loaded: resendApiKey=${this.resendApiKey ? 'present' : 'missing'}, from=${this.emailFrom}`,
    );

    if (!this.resendApiKey) {
      this.logger.error('RESEND_API_KEY is missing. Email delivery will fail until it is configured.');
    }

    if (!this.emailFrom) {
      this.logger.error('EMAIL_FROM is missing. Email delivery will fail until it is configured.');
    }
  }

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  async sendTestEmail(email: string): Promise<{ messageId: string }> {
    return this.dispatch(email, 'Stock AI Resend test email', `
      <h2>Resend delivery test</h2>
      <p>If you received this message, Resend is configured correctly.</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
    `);
  }

  async sendOtpEmail(email: string, otp: string): Promise<void> {
    await this.dispatch(email, 'Your Stock AI verification code', `
      <h2>Verify your email</h2>
      <p>Your one-time code (expires in 10 minutes):</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#0891b2">${otp}</p>
      <p>Enter this code on the verification page. Never share it with anyone.</p>
    `);
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${token}`;
    await this.dispatch(email, 'Verify your Stock AI account', `
      <h2>Welcome to Stock AI</h2>
      <p>Click the link below to verify your email (expires in 24 hours):</p>
      <p><a href="${link}">${link}</a></p>
    `);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${token}`;
    await this.dispatch(email, 'Reset your Stock AI password', `
      <h2>Password reset</h2>
      <p>Click the link below to set a new password (expires in 1 hour):</p>
      <p><a href="${link}">${link}</a></p>
      <p>If you did not request this, ignore this email.</p>
    `);
  }

  async sendLoginAlert(email: string, ip?: string): Promise<void> {
    await this.dispatch(email, 'New sign-in to Stock AI', `
      <p>Your account was used to sign in.</p>
      ${ip ? `<p>IP: ${ip}</p>` : ''}
      <p>If this wasn't you, reset your password immediately.</p>
    `);
  }

  private async dispatch(to: string, subject: string, html: string): Promise<{ messageId: string }> {
    if (!this.resend || !this.resendApiKey) {
      this.logger.error(`Resend is not configured. Refusing to send email to ${this.maskEmail(to)}.`);
      throw new ServiceUnavailableException('Email service is not configured');
    }

    this.logger.log(`Sending email via Resend to ${this.maskEmail(to)} with subject "${subject}"`);

    const result = await this.resend.emails.send({
      from: this.emailFrom,
      to,
      subject,
      html,
    });

    if (result.error) {
      const errorDetails = JSON.stringify(result.error);
      this.logger.error(
        `Resend failed for ${this.maskEmail(to)} with subject "${subject}": ${result.error.message}`,
        errorDetails,
      );
      throw new BadGatewayException(result.error.message || 'Resend rejected the email request');
    }

    const messageId = result.data?.id ?? 'unknown';
    this.logger.log(`Email delivered via Resend to ${this.maskEmail(to)} (messageId=${messageId})`);

    return { messageId };
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) {
      return email;
    }

    const visibleLocal = local.length <= 2 ? `${local[0] ?? '*'}*` : `${local.slice(0, 2)}***`;
    return `${visibleLocal}@${domain}`;
  }
}
