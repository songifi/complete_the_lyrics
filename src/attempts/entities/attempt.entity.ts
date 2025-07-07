import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';

@Entity()
export class Attempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  lyricsId: string;

  @Column('text')
  submittedText: string;

  @Column()
  isCorrect: boolean;

  @Column('float')
  score: number;

  @CreateDateColumn()
  createdAt: Date;
}
