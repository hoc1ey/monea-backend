import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Income } from '../incomes/entities/income.entity.js';
import { Expense } from '../expenses/entities/expense.entity.js';
import { Account } from '../accounts/entities/account.entity.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { ReportsService } from './reports.service.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Income, Expense, Account]),
    AccountsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
