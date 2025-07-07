import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../users/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (data: 'id' | undefined, ctx: ExecutionContext): User | string => {
    const request = ctx.switchToHttp().getRequest() as { user: User };
    const user = request.user;

    // If 'id' is specified, return only the user ID
    if (data === 'id') {
      return user?.id || '';
    }

    // Otherwise, return the full user object
    return user;
  },
);
