import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Debt } from './entities/debt.entity.js';
import { DebtInstallment } from './entities/debt-installment.entity.js';
import { DebtsService } from './debts.service.js';
import { DebtsController } from './debts.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Debt, DebtInstallment]),
    AccountsModule,
    UsersModule,
    NotificationsModule,
    ExpensesModule,
  ],
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService, TypeOrmModule],
})
export class DebtsModule {}
