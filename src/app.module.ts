import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LyricsModule } from './lyrics/lyrics.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { AdminModule } from './admin/admin.module';
import { FlaggedLyricsModule } from './flagged-lyrics/flagged-lyrics.module';
import * as Joi from 'joi';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    LyricsModule,
    AuthModule,
    AttemptsModule,
    UsersModule,
    CommonModule,
    AdminModule,
    FlaggedLyricsModule,
  ],
  controllers: [AppController, AdminController],
  providers: [AppService],
})
export class AppModule {}
