declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        id: string;
        email: string;
        username: string;
        roles?: string[];
        tokenId?: string;
      };
    }
  }
}

export {};
