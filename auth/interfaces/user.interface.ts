// src/auth/interfaces/user.interface.ts
import { Document } from 'mongoose';

export interface User extends Document {
  _id: string;
  username: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  // Add other user properties as needed
}
