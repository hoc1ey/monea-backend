import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditCard } from './entities/credit-card.entity.js';
import { CreditCardPayment } from './entities/credit-card-payment.entity.js';
import { ExpenseInstallment } from '../expenses/entities/expense-installment.entity.js';
import { CreditCardsService } from './credit-cards.service.js';
import { CreditCardBillingService } from './credit-card-billing.service.js';
import { CreditCardsController } from './credit-cards.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditCard, CreditCardPayment, ExpenseInstallment]),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [CreditCardsController],
  providers: [CreditCardsService, CreditCardBillingService],
  exports: [CreditCardsService, CreditCardBillingService, TypeOrmModule],
})
export class CreditCardsModule {}
