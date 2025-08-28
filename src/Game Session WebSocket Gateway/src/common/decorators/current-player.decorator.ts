import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentPlayer = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const wsData = ctx.switchToWs().getData();
    return wsData.playerId;
  }
);
