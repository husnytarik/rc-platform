import { Module } from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { NotificationService } from './notification.service';
import { OutboxProcessor } from './outbox.processor';
import { TicketService } from './ticket.service';

@Module({
  providers: [NotificationService, AnnouncementService, TicketService, OutboxProcessor],
  exports: [NotificationService, AnnouncementService, TicketService],
})
export class EngageModule {}
