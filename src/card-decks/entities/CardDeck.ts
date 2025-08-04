import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { SongCard } from './SongCard';

@Entity()
export class CardDeck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  difficulty: string;

  @Column('json', { nullable: true })
  metadata: any;

  @Column()
  version: string;

  @ManyToMany(() => SongCard, { cascade: true })
  @JoinTable()
  songCards: SongCard[];
}
