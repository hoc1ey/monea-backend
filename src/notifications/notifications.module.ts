import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity.js';
import { Reminder } from './entities/reminder.entity.js';
import { NotificationsService } from './notifications.service.js';
import { ReminderService } from './reminder.service.js';
import { ReminderScheduler } from './reminder.scheduler.js';
import { NotificationsController } from './notifications.controller.js';
import { firebaseProvider } from './firebase.provider.js';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken, Reminder])],
  controllers: [NotificationsController],
  providers: [
    firebaseProvider,
    NotificationsService,
    ReminderService,
    ReminderScheduler,
  ],
  exports: [
    NotificationsService,
    ReminderService,
    firebaseProvider,
    TypeOrmModule,
  ],
})
export class NotificationsModule {}
