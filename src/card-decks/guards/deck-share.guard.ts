import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class DeckShareGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Implement permission logic here
    return true;
  }
}
