import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JWT_STRATEGY } from '../constants/auth.constants';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, JWT_STRATEGY.ACCESS) {
  constructor(configService: ConfigService) {
    const hasGetOrThrow = typeof (configService as any).getOrThrow === 'function';
    const jwtSecret = hasGetOrThrow
      ? (() => {
          const value = (configService as any).getOrThrow('JWT_SECRET');
          if (typeof value !== 'string' || value.length === 0) {
            throw new Error('JWT_SECRET is not configured');
          }
          return value;
        })()
      : (() => {
          const value = configService.get<string>('JWT_SECRET');
          if (!value) {
            throw new Error('JWT_SECRET is not configured');
          }
          return value;
        })();

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    if (!payload.sub || !payload.email || !payload.username) {
      throw new UnauthorizedException('Invalid token payload');
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      roles: payload.roles || [],
    };

    return req.user;
  }
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, JWT_STRATEGY.REFRESH) {
  constructor(configService: ConfigService) {
    const hasGetOrThrow = typeof (configService as any).getOrThrow === 'function';
    const refreshSecret = hasGetOrThrow
      ? (() => {
          const value = (configService as any).getOrThrow('JWT_REFRESH_SECRET');
          if (typeof value !== 'string' || value.length === 0) {
            throw new Error('JWT_REFRESH_SECRET is not configured');
          }
          return value;
        })()
      : (() => {
          const value = configService.get<string>('JWT_REFRESH_SECRET');
          if (!value) {
            throw new Error('JWT_REFRESH_SECRET is not configured');
          }
          return value;
        })();

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: refreshSecret,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    if (!payload.sub || !payload.tokenId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    req.user = {
      id: payload.sub,
      tokenId: payload.tokenId,
    };

    return req.user;
  }
}
