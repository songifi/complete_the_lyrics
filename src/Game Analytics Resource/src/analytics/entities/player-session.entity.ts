import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { ObjectType, Field, ID, Int, Float } from "@nestjs/graphql"

@ObjectType()
@Entity("player_sessions")
@Index(["playerId", "startTime"])
@Index(["endTime"])
export class PlayerSession {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Field()
  @Column()
  @Index()
  playerId: string

  @Field()
  @CreateDateColumn()
  @Index()
  startTime: Date

  @Field({ nullable: true })
  @Column({ nullable: true })
  endTime: Date

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  duration: number

  @Field(() => Int, { defaultValue: 0 })
  @Column({ default: 0 })
  eventsCount: number

  @Field(() => Float, { nullable: true })
  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  revenue: number

  @Field({ nullable: true })
  @Column({ nullable: true })
  platform: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  deviceType: string

  @Field({ nullable: true })
  @Column({ nullable: true })
  country: string

  @Field()
  @Column("jsonb", { default: {} })
  metadata: Record<string, any>

  @Field()
  @CreateDateColumn()
  createdAt: Date

  @Field()
  @UpdateDateColumn()
  updatedAt: Date
}
