import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  async list(
    @Req() req: Request & { user: { id: string } },
    @Query('page') page?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const result = await this.notifications.list(
      req.user.id,
      Number(page) || 1,
      30,
      unreadOnly === 'true',
    );
    return { success: true, ...result };
  }

  @Patch('mark-all-read')
  async markAllRead(@Req() req: Request & { user: { id: string } }) {
    return this.notifications.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  async markRead(@Req() req: Request & { user: { id: string } }, @Param('id') id: string) {
    const data = await this.notifications.markRead(req.user.id, id);
    return { success: true, data };
  }
}
