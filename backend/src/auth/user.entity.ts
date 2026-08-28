import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AuthProvider = 'password' | 'google';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'text', default: 'password' })
  authProvider!: AuthProvider;

  @Index()
  @Column({ type: 'text', nullable: true })
  googleSub!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
