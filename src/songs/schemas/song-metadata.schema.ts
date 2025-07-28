import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SongMetadataDocument = SongMetadata & Document;

@Schema({ timestamps: true })
export class SongMetadata {
  @Prop({ required: true, unique: true })
  songId: string;

  @Prop({ type: Object })
  customFields: Record<string, any>;

  @Prop({ type: [String] })
  instruments: string[];

  @Prop({ type: Object })
  technicalData: {
    bpm?: number;
    key?: string;
    timeSignature?: string;
    bitrate?: number;
    sampleRate?: number;
  };

  @Prop({ type: Object })
  performanceMetrics: {
    complexity?: number;
    rhythmComplexity?: number;
    harmonicComplexity?: number;
    melodicComplexity?: number;
  };

  @Prop({ type: [Object] })
  versions: Array<{
    version: string;
    description: string;
    filePath: string;
    createdAt: Date;
  }>;

  @Prop({ type: Object })
  credits: {
    composer?: string;
    lyricist?: string;
    arranger?: string;
    producer?: string;
  };
}

export const SongMetadataSchema = SchemaFactory.createForClass(SongMetadata);
