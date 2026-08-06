import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FileVersion } from './file-version.entity';
import { BlobStorageService, StoredBlob } from './blob-storage.service';

@Injectable()
export class PostgresBlobStorageService extends BlobStorageService {
  constructor(
    @InjectRepository(FileVersion)
    private readonly versionRepository: Repository<FileVersion>,
  ) {
    super();
  }

  async store(
    manager: EntityManager,
    fileId: string,
    versionNo: number,
    blob: StoredBlob,
  ): Promise<FileVersion> {
    const version = manager.create(FileVersion, {
      fileId,
      versionNo,
      blob: blob.data,
      iv: blob.iv,
      authTag: blob.authTag,
      byteLength: blob.byteLength,
      sha256: blob.sha256,
    });
    return manager.save(FileVersion, version);
  }

  async load(
    manager: EntityManager,
    fileId: string,
    versionNo: number,
  ): Promise<FileVersion | null> {
    return manager.findOne(FileVersion, {
      where: { fileId, versionNo },
    });
  }
}
