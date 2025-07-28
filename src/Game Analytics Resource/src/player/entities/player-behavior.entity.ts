import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { ObjectType, Field, ID, Float, Int } from "@nestjs/graphql"

@ObjectType()
@Entity("player_behavior")
@Index(["playerId", "date"])
@Index(["segment", "date"])
export class PlayerBehavior {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Field()
  @Column()
  @Index()
  playerId: string

  @Field()
  @Column("date")
  @Index()
  date: Date

  @Field(() => Int)
  @Column({ default: 0 })
  sessionsCount: number

  @Field(() => Int)
  @Column({ default: 0 })
  totalPlayTime: number

  @Field(() => Float)
  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  totalRevenue: number

  @Field(() => Int)
  @Column({ default: 0 })
  eventsCount: number

  @Field({ nullable: true })
  @Column({ nullable: true })
  @Index()
  segment: string

  @Field(() => Float, { nullable: true })
  @Column("decimal", { precision: 5, scale: 4, nullable: true })
  churnProbability: number

  @Field(() => Float, { nullable: true })
  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  ltv: number

  @Field()
  @Column("jsonb", { default: {} })
  behaviorMetrics: Record<string, any>

  @Field()
  @CreateDateColumn()
  createdAt: Date

  @Field()
  @UpdateDateColumn()
  updatedAt: Date
}
