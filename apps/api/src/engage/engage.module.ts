import { Module } from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { NotificationService } from './notification.service';
import { OutboxProcessor } from './outbox.processor';
import { RecipeService } from './recipe.service';
import { TicketService } from './ticket.service';

@Module({
  providers: [NotificationService, AnnouncementService, TicketService, RecipeService, OutboxProcessor],
  exports: [NotificationService, AnnouncementService, TicketService, RecipeService],
})
export class EngageModule {}
