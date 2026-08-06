import { EntityManager } from 'typeorm';
import { FileVersion } from './file-version.entity';

export interface StoredBlob {
  iv: string;
  authTag: string;
  byteLength: number;
  sha256: string;
  data: Buffer;
}

export abstract class BlobStorageService {
  abstract store(
    manager: EntityManager,
    fileId: string,
    versionNo: number,
    blob: StoredBlob,
  ): Promise<FileVersion>;

  abstract load(
    manager: EntityManager,
    fileId: string,
    versionNo: number,
  ): Promise<FileVersion | null>;
}
