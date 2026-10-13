import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { firebaseProvider } from './firebase.provider.js';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  controllers: [NotificationsController],
  providers: [firebaseProvider, NotificationsService],
  exports: [NotificationsService, firebaseProvider, TypeOrmModule],
})
export class NotificationsModule {}
