import { Body, Controller, Post } from '@nestjs/common';
import { MailService } from './mail.service';
import { SendTestEmailDto } from './dto/send-test-email.dto';

@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Post('test-email')
  async testEmail(@Body() dto: SendTestEmailDto) {
    const result = await this.mail.sendTestEmail(dto.email);

    return {
      success: true,
      data: {
        email: dto.email,
        messageId: result.messageId,
      },
    };
  }
}
