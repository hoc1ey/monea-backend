import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingList } from './entities/shopping-list.entity.js';
import { ShoppingListItem } from './entities/shopping-list-item.entity.js';
import { ShoppingListsService } from './shopping-lists.service.js';
import { ShoppingListsController } from './shopping-lists.controller.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingList, ShoppingListItem]),
    AccountsModule,
    ExpensesModule,
  ],
  controllers: [ShoppingListsController],
  providers: [ShoppingListsService],
  exports: [ShoppingListsService, TypeOrmModule],
})
export class ShoppingListsModule {}
