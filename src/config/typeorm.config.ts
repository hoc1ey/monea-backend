import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    url: configService.getOrThrow<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize: configService.getOrThrow<boolean>('DB_SYNCHRONIZE'),
    ssl: configService.getOrThrow<boolean>('DB_SSL')
      ? { rejectUnauthorized: false }
      : false,
  }),
};
