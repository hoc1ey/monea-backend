import { Global, Module, OnApplicationShutdown, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis => {
        const logger = new Logger('RedisModule');
        const redisUrl = configService.getOrThrow<string>('REDIS_URL');

        const client = new Redis(redisUrl, {
          maxRetriesPerRequest: null,
          lazyConnect: true,
          enableReadyCheck: false,
        });

        client.on('error', (err) => {
          logger.error(`Redis connection error: ${err.message}`);
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      this.logger.log('Closing Redis connection...');
      await this.redisClient.quit();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error closing Redis connection: ${message}`);
    }
  }
}
