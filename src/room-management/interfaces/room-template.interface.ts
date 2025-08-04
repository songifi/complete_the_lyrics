import { RoomAccessType } from '../enums';
import { RoomConfiguration } from './room-configuration.interface';

export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  accessType: RoomAccessType;
  configuration: RoomConfiguration;
  defaultRoles: string[];
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface RoomPreset {
  name: string;
  description: string;
  icon?: string;
  configuration: Partial<RoomConfiguration>;
  recommendedFor: string[];
}
