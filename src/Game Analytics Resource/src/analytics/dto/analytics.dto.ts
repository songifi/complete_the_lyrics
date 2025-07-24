import { InputType, Field, Float, Int } from "@nestjs/graphql"
import { IsString, IsOptional, IsNumber, IsObject } from "class-validator"

@InputType()
export class TrackEventInput {
  @Field()
  @IsString()
  playerId: string

  @Field()
  @IsString()
  sessionId: string

  @Field()
  @IsString()
  eventType: string

  @Field()
  @IsObject()
  eventData: Record<string, any>

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  value?: number

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  level?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  gameMode?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  platform?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  version?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  country?: string

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deviceType?: string

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  duration?: number
}

@InputType()
export class SessionMetricsInput {
  @Field()
  @IsString()
  playerId: string

  @Field(() => Int, { defaultValue: 30 })
  @IsOptional()
  @IsNumber()
  days?: number
}
