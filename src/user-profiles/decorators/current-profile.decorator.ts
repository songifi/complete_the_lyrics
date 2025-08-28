import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentProfile = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.userProfile;
  },
);
