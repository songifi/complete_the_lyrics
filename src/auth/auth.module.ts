import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { EmailService } from './services/email.service';
import { JwtAccessStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt.strategy';
import { JwtAccessGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-auth.guard';
import { OptionalJwtGuard } from './guards/jwt-auth.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { TwitterStrategy } from './strategies/twitter.strategy';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AUTH_CONSTANTS } from './constants/auth.constants';
import { UserSubscriber } from './subscribers/user.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV');
        const isProduction = nodeEnv === 'production';
        const jwtSecret = configService.get<string>('JWT_SECRET');

        if (isProduction && !jwtSecret) {
          throw new Error(
            'JWT_SECRET is required in production. Please set process.env.JWT_SECRET.'
          );
        }

        return {
          secret: jwtSecret || AUTH_CONSTANTS.JWT_SECRET,
          signOptions: {
            expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    UserSubscriber,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtAccessGuard,
    JwtRefreshGuard,
    OptionalJwtGuard,
    GoogleStrategy,
    FacebookStrategy,
    GitHubStrategy,
    TwitterStrategy,
  ],
  exports: [
    AuthService,
    EmailService,
    JwtAccessGuard,
    JwtRefreshGuard,
    OptionalJwtGuard,
    TypeOrmModule,
  ],
})
export class AuthModule {}
