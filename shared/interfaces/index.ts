// src/shared/interfaces/index.ts
import { Document } from 'mongoose';
import { Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  // Add other user properties
}

export interface IChatMessage extends Document {
  content: string;
  sender: Types.ObjectId | IUser;
  threadId?: Types.ObjectId;
  roomId?: Types.ObjectId;
  isPrivate: boolean;
  recipients: Types.ObjectId[];
  reactions: {
    emoji: string;
    users: Types.ObjectId[];
  }[];
  encryptedContent?: string;
  encryptionIv?: string;
  isFlagged: boolean;
}
