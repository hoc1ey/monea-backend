import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.schema.js';
import { typeOrmAsyncConfig } from './config/typeorm.config.js';
import { RedisModule } from './config/redis.module.js';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { IncomesModule } from './incomes/incomes.module.js';
import { CreditCardsModule } from './credit-cards/credit-cards.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { RecurringExpensesModule } from './recurring-expenses/recurring-expenses.module.js';
import { CollectionsModule } from './collections/collections.module.js';
import { LoansModule } from './loans/loans.module.js';
import { DebtsModule } from './debts/debts.module.js';
import { ShoppingListsModule } from './shopping-lists/shopping-lists.module.js';
import { MailModule } from './mail/mail.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RateLimitGuard } from './common/guards/rate-limit.guard.js';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './config/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (configService: ConfigService, redisClient: Redis) => ({
        throttlers: [
          {
            name: 'strict',
            limit: configService.get<number>('RATE_LIMIT_STRICT_LIMIT', 10),
            ttl: configService.get<number>('RATE_LIMIT_STRICT_TTL_SECONDS', 60) * 1000,
            blockDuration:
              configService.get<number>('RATE_LIMIT_STRICT_BLOCK_SECONDS', 60) * 1000,
            skipIf: (context) => {
              // El throttler 'strict' se aplica a rutas públicas.
              // Se salta en rutas autenticadas (donde el usuario está en req).
              const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
              return !!req.user?.id;
            },
          },
          {
            name: 'relaxed',
            limit: configService.get<number>('RATE_LIMIT_RELAXED_LIMIT', 100),
            ttl: configService.get<number>('RATE_LIMIT_RELAXED_TTL_SECONDS', 60) * 1000,
            blockDuration:
              configService.get<number>('RATE_LIMIT_RELAXED_BLOCK_SECONDS', 60) * 1000,
            skipIf: (context) => {
              // El throttler 'relaxed' se aplica a rutas autenticadas.
              // Se salta en rutas públicas (donde el usuario no está en req).
              const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
              return !req.user?.id;
            },
          },
        ],
        storage: new ThrottlerStorageRedisService(redisClient),
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    AccountsModule,
    NotificationsModule,
    IncomesModule,
    CreditCardsModule,
    ExpensesModule,
    RecurringExpensesModule,
    CollectionsModule,
    LoansModule,
    DebtsModule,
    ShoppingListsModule,
    MailModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
