import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { File } from './file.entity';
import { FileVersion } from './file-version.entity';
import { BlobStorageService } from './blob-storage.service';
import { UpsertFileDto } from './dto/upsert-file.dto';
import { VaultsService } from '../vaults/vaults.service';

export interface FileResponse {
  id: string;
  vaultId: string;
  path: string;
  currentVersionNo: number;
  updatedAt: Date;
}

export interface VersionEnvelope {
  file: FileResponse;
  version: {
    versionNo: number;
    iv: string;
    authTag: string;
    data: string;
    byteLength: number;
    sha256: string;
    createdAt: Date;
  };
}

export interface VersionMeta {
  versionNo: number;
  byteLength: number;
  sha256: string;
  createdAt: Date;
}

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly vaultsService: VaultsService,
    private readonly blobStorage: BlobStorageService,
  ) {}

  async upsert(
    ownerId: string,
    vaultId: string,
    dto: UpsertFileDto,
  ): Promise<VersionEnvelope> {
    await this.vaultsService.findOwned(ownerId, vaultId);

    const data = Buffer.from(dto.data, 'base64');
    if (data.length === 0) {
      throw new BadRequestException('Encrypted content must not be empty');
    }

    return this.dataSource.transaction(async (manager) => {
      const fileRepo = manager.getRepository(File);
      const existing = await fileRepo.findOne({
        where: { vaultId, path: dto.path },
        lock: { mode: 'pessimistic_write' },
      });

      let file: File;
      let versionNo: number;

      if (existing) {
        if (dto.baseVersion === undefined) {
          throw new ConflictException(
            'baseVersion is required when updating an existing file',
          );
        }
        if (dto.baseVersion !== existing.currentVersionNo) {
          throw new ConflictException('File changed since baseVersion');
        }
        file = existing;
        versionNo = existing.currentVersionNo + 1;
      } else {
        if (dto.baseVersion !== undefined && dto.baseVersion !== 0) {
          throw new ConflictException(
            'A new file must use baseVersion 0 or omit it',
          );
        }
        file = await fileRepo.save(
          fileRepo.create({ vaultId, path: dto.path, currentVersionNo: 0 }),
        );
        versionNo = 1;
      }

      const sha256 = crypto.createHash('sha256').update(data).digest('hex');

      const version = await this.blobStorage.store(
        manager,
        file.id,
        versionNo,
        {
          iv: dto.iv,
          authTag: dto.authTag,
          byteLength: data.length,
          sha256,
          data,
        },
      );

      file.currentVersionNo = versionNo;
      await fileRepo.save(file);

      return this.serializeEnvelope(file, version);
    });
  }

  async findAll(ownerId: string, vaultId: string): Promise<FileResponse[]> {
    await this.vaultsService.findOwned(ownerId, vaultId);
    const files = await this.fileRepository.find({
      where: { vaultId },
      order: { path: 'ASC' },
    });
    return files.map((f) => this.serializeFile(f));
  }

  async findLatest(
    ownerId: string,
    vaultId: string,
    fileId: string,
  ): Promise<VersionEnvelope> {
    const file = await this.getOwnedFile(ownerId, vaultId, fileId);
    if (file.currentVersionNo === 0) {
      throw new NotFoundException('File has no versions yet');
    }
    const version = await this.blobStorage.load(
      this.dataSource.manager,
      file.id,
      file.currentVersionNo,
    );
    if (!version) {
      throw new NotFoundException('Current version not found');
    }
    return this.serializeEnvelope(file, version);
  }

  async listVersions(
    ownerId: string,
    vaultId: string,
    fileId: string,
  ): Promise<VersionMeta[]> {
    const file = await this.getOwnedFile(ownerId, vaultId, fileId);
    const versions = await this.dataSource.manager.find(FileVersion, {
      where: { fileId: file.id },
      select: {
        versionNo: true,
        byteLength: true,
        sha256: true,
        createdAt: true,
      },
      order: { versionNo: 'DESC' },
    });
    return versions.map((v) => this.serializeMeta(v));
  }

  async findVersion(
    ownerId: string,
    vaultId: string,
    fileId: string,
    versionNo: number,
  ): Promise<VersionEnvelope> {
    const file = await this.getOwnedFile(ownerId, vaultId, fileId);
    const version = await this.blobStorage.load(
      this.dataSource.manager,
      file.id,
      versionNo,
    );
    if (!version) {
      throw new NotFoundException(`Version ${versionNo} not found`);
    }
    return this.serializeEnvelope(file, version);
  }

  async restore(
    ownerId: string,
    vaultId: string,
    fileId: string,
    versionNo: number,
  ): Promise<VersionEnvelope> {
    const file = await this.getOwnedFile(ownerId, vaultId, fileId);

    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.getRepository(File).findOne({
        where: { id: file.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException(`File ${fileId} not found`);
      }

      const source = await this.blobStorage.load(manager, file.id, versionNo);
      if (!source) {
        throw new NotFoundException(`Version ${versionNo} not found`);
      }

      const newVersionNo = locked.currentVersionNo + 1;
      const restored = await this.blobStorage.store(
        manager,
        file.id,
        newVersionNo,
        {
          iv: source.iv,
          authTag: source.authTag,
          byteLength: source.byteLength,
          sha256: source.sha256,
          data: source.blob,
        },
      );

      locked.currentVersionNo = newVersionNo;
      await manager.getRepository(File).save(locked);

      return this.serializeEnvelope(locked, restored);
    });
  }

  async remove(
    ownerId: string,
    vaultId: string,
    fileId: string,
  ): Promise<void> {
    const file = await this.getOwnedFile(ownerId, vaultId, fileId);
    await this.fileRepository.remove(file);
  }

  private async getOwnedFile(
    ownerId: string,
    vaultId: string,
    fileId: string,
  ): Promise<File> {
    await this.vaultsService.findOwned(ownerId, vaultId);
    const file = await this.fileRepository.findOne({
      where: { id: fileId, vaultId },
    });
    if (!file) {
      throw new NotFoundException(`File ${fileId} not found`);
    }
    return file;
  }

  private serializeFile(file: File): FileResponse {
    return {
      id: file.id,
      vaultId: file.vaultId,
      path: file.path,
      currentVersionNo: file.currentVersionNo,
      updatedAt: file.updatedAt,
    };
  }

  private serializeEnvelope(file: File, version: FileVersion): VersionEnvelope {
    return {
      file: this.serializeFile(file),
      version: {
        versionNo: version.versionNo,
        iv: version.iv,
        authTag: version.authTag,
        data: version.blob.toString('base64'),
        byteLength: version.byteLength,
        sha256: version.sha256,
        createdAt: version.createdAt,
      },
    };
  }

  private serializeMeta(version: FileVersion): VersionMeta {
    return {
      versionNo: version.versionNo,
      byteLength: version.byteLength,
      sha256: version.sha256,
      createdAt: version.createdAt,
    };
  }
}
