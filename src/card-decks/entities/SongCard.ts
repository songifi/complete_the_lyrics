import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class SongCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  artist: string;

  @Column()
  difficulty: string;

  @Column('json', { nullable: true })
  metadata: any;
}
