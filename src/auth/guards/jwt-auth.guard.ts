import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { JWT_STRATEGY } from '../constants/auth.constants';

@Injectable()
export class JwtAccessGuard extends AuthGuard(JWT_STRATEGY.ACCESS) {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return user;
  }
}

@Injectable()
export class JwtRefreshGuard extends AuthGuard(JWT_STRATEGY.REFRESH) {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return user;
  }
}

@Injectable()
export class OptionalJwtGuard extends AuthGuard(JWT_STRATEGY.ACCESS) {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Don't throw error if no user, just return null
    if (err) {
      return null;
    }
    return user;
  }
}
