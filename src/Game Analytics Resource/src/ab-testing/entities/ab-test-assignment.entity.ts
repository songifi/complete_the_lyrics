import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"
import { ObjectType, Field, ID } from "@nestjs/graphql"

@ObjectType()
@Entity("ab_test_assignments")
@Index(["testId", "playerId"], { unique: true })
@Index(["playerId", "assignedAt"])
export class ABTestAssignment {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Field()
  @Column()
  @Index()
  testId: string

  @Field()
  @Column()
  @Index()
  playerId: string

  @Field()
  @Column()
  variantId: string

  @Field()
  @CreateDateColumn()
  @Index()
  assignedAt: Date

  @Field()
  @Column("jsonb", { default: {} })
  playerContext: Record<string, any>
}
