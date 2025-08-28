@Entity('player_answers')
export class PlayerAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roundId: string;

  @Column()
  playerId: string;

  @Column()
  questionIndex: number;

  @Column({ nullable: true })
  answer: string;

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'timestamp' })
  submittedAt: Date;

  @Column({ type: 'int', nullable: true })
  timeToAnswer: number; // milliseconds

  @CreateDateColumn()
  createdAt: Date;
}