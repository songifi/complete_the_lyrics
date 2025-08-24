declare module "express-rate-limit" {
  import { Request, Response, NextFunction } from "express";

  export interface RateLimitOptions {
    windowMs?: number;
    max?: number | ((req: Request, res: Response) => number);
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    keyGenerator?: (req: Request, res: Response) => string;
    handler?: (req: Request, res: Response, next: NextFunction) => void;
    skip?: (req: Request, res: Response) => boolean;
    message?: unknown;
  }

  export type RateLimitRequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;

  export default function rateLimit(
    options?: RateLimitOptions,
  ): RateLimitRequestHandler;
}
