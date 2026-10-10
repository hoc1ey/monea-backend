import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.schema.js';
import { typeOrmAsyncConfig } from './config/typeorm.config.js';
import { RedisModule } from './config/redis.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    RedisModule,
    HealthModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
