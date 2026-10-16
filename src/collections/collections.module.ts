import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Collection } from './entities/collection.entity.js';
import { CollectionInstallment } from './entities/collection-installment.entity.js';
import { CollectionsService } from './collections.service.js';
import { CollectionsController } from './collections.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { IncomesModule } from '../incomes/incomes.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Collection, CollectionInstallment]),
    AccountsModule,
    UsersModule,
    NotificationsModule,
    IncomesModule,
  ],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService, TypeOrmModule],
})
export class CollectionsModule {}
