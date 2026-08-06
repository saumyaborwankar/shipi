import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { File } from './file.entity';

@Entity('file_versions')
@Unique('UQ_file_versions_file_version', ['fileId', 'versionNo'])
export class FileVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  fileId!: string;

  @ManyToOne(() => File, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file!: File;

  @Column({ type: 'int' })
  versionNo!: number;

  @Column({ type: 'bytea' })
  blob!: Buffer;

  @Column({ type: 'text' })
  iv!: string;

  @Column({ type: 'text' })
  authTag!: string;

  @Column({ type: 'int' })
  byteLength!: number;

  @Column({ type: 'text' })
  sha256!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
