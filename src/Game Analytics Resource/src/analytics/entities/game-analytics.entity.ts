import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { ObjectType, Field, ID, Float, Int } from "@nestjs/graphql"

@ObjectType()
@Entity("game_analytics")
@Index(["playerId", "eventType", "timestamp"])
@Index(["sessionId", "timestamp"])
@Index(["eventType", "timestamp"])
export class GameAnalytics {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Field()
  @Column()
  @Index()
  playerId: string

  @Field()
  @Column()
  @Index()
  sessionId: string

  @Field()
  @Column()
  @Index()
  eventType: string

  @Field()
  @Column("jsonb")
  eventData: Record<string, any>

  @Field(() => Float, { nullable: true })
  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  value: number

  @Field({ nullable: true })
  @Column({ nullable: true })
  level: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  gameMode: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  platform: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  version: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  country: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  deviceType: string

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  duration: number

  @Field()
  @CreateDateColumn()
  @Index()
  timestamp: Date

  @Field()
  @CreateDateColumn()
  createdAt: Date

  @Field()
  @UpdateDateColumn()
  updatedAt: Date
}
