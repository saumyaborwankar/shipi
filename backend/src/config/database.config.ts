import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('SUPABASE_HOST'),
  port: configService.get<number>('SUPABASE_PORT'),
  username: configService.get<string>('SUPABASE_USER'),
  password: configService.get<string>('SUPABASE_PASSWORD'),
  database: configService.get<string>('SUPABASE_DB'),
  autoLoadEntities: true,
  synchronize: false,
  ssl: {
    rejectUnauthorized: false,
  },
});
