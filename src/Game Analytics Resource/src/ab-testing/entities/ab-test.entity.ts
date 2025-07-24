import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { ObjectType, Field, ID, Int, Float } from "@nestjs/graphql"

export enum TestStatus {
  DRAFT = "draft",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
}

@ObjectType()
@Entity("ab_tests")
@Index(["status", "startDate"])
export class ABTest {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Field()
  @Column()
  name: string

  @Field()
  @Column("text")
  description: string

  @Field()
  @Column({
    type: "enum",
    enum: TestStatus,
    default: TestStatus.DRAFT,
  })
  @Index()
  status: TestStatus

  @Field()
  @Column("jsonb")
  variants: Array<{
    id: string
    name: string
    weight: number
    config: Record<string, any>
  }>

  @Field()
  @Column()
  @Index()
  startDate: Date

  @Field({ nullable: true })
  @Column({ nullable: true })
  endDate: Date

  @Field(() => Int)
  @Column({ default: 0 })
  targetSampleSize: number

  @Field(() => Float)
  @Column("decimal", { precision: 5, scale: 4, default: 0.05 })
  significanceLevel: number

  @Field()
  @Column("jsonb")
  metrics: Array<{
    name: string
    type: "conversion" | "revenue" | "retention"
    goal: "increase" | "decrease"
  }>

  @Field()
  @Column("jsonb", { default: {} })
  segmentationCriteria: Record<string, any>

  @Field()
  @CreateDateColumn()
  createdAt: Date

  @Field()
  @UpdateDateColumn()
  updatedAt: Date
}
