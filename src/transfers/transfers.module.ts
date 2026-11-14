import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transfer } from './entities/transfer.entity.js';
import { TransfersService } from './transfers.service.js';
import { TransfersController } from './transfers.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { IncomesModule } from '../incomes/incomes.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer]),
    AccountsModule,
    ExpensesModule,
    IncomesModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService, TypeOrmModule],
})
export class TransfersModule {}
