import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Income } from './entities/income.entity.js';
import { IncomesService } from './incomes.service.js';
import { IncomesController } from './incomes.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Income]),
    AccountsModule,
  ],
  controllers: [IncomesController],
  providers: [IncomesService],
  exports: [IncomesService, TypeOrmModule],
})
export class IncomesModule {}
