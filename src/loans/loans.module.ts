import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan } from './entities/loan.entity.js';
import { LoanInstallment } from './entities/loan-installment.entity.js';
import { LoansService } from './loans.service.js';
import { LoansController } from './loans.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { IncomesModule } from '../incomes/incomes.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, LoanInstallment]),
    AccountsModule,
    UsersModule,
    NotificationsModule,
    IncomesModule,
    ExpensesModule,
  ],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService, TypeOrmModule],
})
export class LoansModule {}
