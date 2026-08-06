import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Vault } from '../vaults/vault.entity';

@Entity('files')
@Unique('UQ_files_vault_path', ['vaultId', 'path'])
export class File {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  vaultId!: string;

  @ManyToOne(() => Vault, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vaultId' })
  vault!: Vault;

  @Column({ type: 'text' })
  path!: string;

  @Column({ type: 'int', default: 0 })
  currentVersionNo!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
