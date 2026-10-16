import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringExpenseConfig } from './entities/recurring-expense-config.entity.js';
import { RecurringExpensesService } from './recurring-expenses.service.js';
import { RecurringExpensesController } from './recurring-expenses.controller.js';
import { RecurringExpensesScheduler } from './recurring-expenses.scheduler.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringExpenseConfig]),
    AccountsModule,
    UsersModule,
    NotificationsModule,
    ExpensesModule,
  ],
  controllers: [RecurringExpensesController],
  providers: [RecurringExpensesService, RecurringExpensesScheduler],
  exports: [RecurringExpensesService, TypeOrmModule],
})
export class RecurringExpensesModule {}
