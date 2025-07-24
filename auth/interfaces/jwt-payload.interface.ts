// src/auth/interfaces/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string; // user ID
  username: string;
  iat?: number; // issued at
  exp?: number; // expiration time
}

export interface JwtUser {
  userId: string;
  username: string;
}
