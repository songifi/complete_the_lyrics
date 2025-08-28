@Entity('buzz_ins')
export class BuzzIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roundId: string;

  @Column()
  playerId: string;

  @Column()
  questionIndex: number;

  @Column({ type: 'timestamp' })
  buzzedAt: Date;

  @Column({ type: 'int' })
  buzzOrder: number;

  @Column({ type: 'boolean', default: false })
  wasAnswered: boolean;
}