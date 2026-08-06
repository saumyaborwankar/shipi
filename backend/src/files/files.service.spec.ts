import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FilesService } from './files.service';
import { File } from './file.entity';
import { FileVersion } from './file-version.entity';
import { BlobStorageService } from './blob-storage.service';
import { VaultsService } from '../vaults/vaults.service';

const DATA_1 = Buffer.from('c2VjcmV0').toString('base64');
const DATA_2 = Buffer.from('c2VjcmV0LXNlY3JldA==').toString('base64');

const makeVersion = (
  versionNo: number,
  data: Buffer,
): Partial<FileVersion> => ({
  versionNo,
  iv: 'AAAAAAAAAAAAAAAA',
  authTag: 'AAAAAAAAAAAAAAAAAAAAAAAA',
  byteLength: data.length,
  sha256: 'sha',
  blob: data,
  createdAt: new Date(),
});

describe('FilesService', () => {
  let service: FilesService;
  const fileRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const transactionManager = {
    getRepository: jest.fn().mockReturnValue(fileRepository),
    find: jest.fn(),
  };
  const dataSource = {
    manager: { find: jest.fn() },
    transaction: jest.fn((cb: (m: typeof transactionManager) => unknown) =>
      cb(transactionManager),
    ),
  };
  const vaultsService = { findOwned: jest.fn() };
  const blobStorage = { store: jest.fn(), load: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(File), useValue: fileRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: VaultsService, useValue: vaultsService },
        { provide: BlobStorageService, useValue: blobStorage },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    vaultsService.findOwned.mockResolvedValue({ id: 'vault-1' });
  });

  describe('upsert', () => {
    it('creates a new file as version 1', async () => {
      fileRepository.findOne.mockResolvedValue(null);
      fileRepository.create.mockImplementation((dto: Partial<File>) => dto);
      fileRepository.save.mockResolvedValue({
        id: 'file-1',
        vaultId: 'vault-1',
        path: 'Notes/Welcome.md',
        currentVersionNo: 0,
      });
      blobStorage.store.mockResolvedValue(makeVersion(1, Buffer.from(DATA_1)));

      const result = await service.upsert('user-1', 'vault-1', {
        path: 'Notes/Welcome.md',
        iv: 'AAAAAAAAAAAAAAAA',
        authTag: 'AAAAAAAAAAAAAAAAAAAAAAAA',
        data: DATA_1,
        baseVersion: 0,
      });

      expect(blobStorage.store).toHaveBeenCalledWith(
        transactionManager,
        'file-1',
        1,
        expect.objectContaining({ iv: 'AAAAAAAAAAAAAAAA' }),
      );
      expect(result.version.versionNo).toBe(1);
      expect(result.file.currentVersionNo).toBe(1);
    });

    it('appends version 2 when baseVersion matches', async () => {
      fileRepository.findOne.mockResolvedValue({
        id: 'file-1',
        vaultId: 'vault-1',
        path: 'Notes/Welcome.md',
        currentVersionNo: 1,
      });
      blobStorage.store.mockResolvedValue(makeVersion(2, Buffer.from(DATA_2)));

      const result = await service.upsert('user-1', 'vault-1', {
        path: 'Notes/Welcome.md',
        iv: 'AAAAAAAAAAAAAAAA',
        authTag: 'AAAAAAAAAAAAAAAAAAAAAAAA',
        data: DATA_2,
        baseVersion: 1,
      });

      expect(blobStorage.store).toHaveBeenCalledWith(
        transactionManager,
        'file-1',
        2,
        expect.anything(),
      );
      expect(result.version.versionNo).toBe(2);
    });

    it('rejects a stale baseVersion with 409', async () => {
      fileRepository.findOne.mockResolvedValue({
        id: 'file-1',
        currentVersionNo: 2,
      });
      await expect(
        service.upsert('user-1', 'vault-1', {
          path: 'p.md',
          iv: 'AAAAAAAAAAAAAAAA',
          authTag: 'AAAAAAAAAAAAAAAAAAAAAAAA',
          data: DATA_1,
          baseVersion: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('requires baseVersion when the file already exists', async () => {
      fileRepository.findOne.mockResolvedValue({
        id: 'file-1',
        currentVersionNo: 2,
      });
      await expect(
        service.upsert('user-1', 'vault-1', {
          path: 'p.md',
          iv: 'AAAAAAAAAAAAAAAA',
          authTag: 'AAAAAAAAAAAAAAAAAAAAAAAA',
          data: DATA_1,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findLatest', () => {
    it('returns the current version envelope', async () => {
      fileRepository.findOne.mockResolvedValue({
        id: 'file-1',
        vaultId: 'vault-1',
        path: 'p.md',
        currentVersionNo: 2,
        updatedAt: new Date(),
      });
      blobStorage.load.mockResolvedValue(makeVersion(2, Buffer.from(DATA_2)));

      const result = await service.findLatest('user-1', 'vault-1', 'file-1');
      expect(blobStorage.load).toHaveBeenCalledWith(
        dataSource.manager,
        'file-1',
        2,
      );
      expect(result.version.versionNo).toBe(2);
    });
  });

  describe('restore', () => {
    it('copies an old version into a new version (non-destructive)', async () => {
      fileRepository.findOne.mockResolvedValue({
        id: 'file-1',
        vaultId: 'vault-1',
        path: 'p.md',
        currentVersionNo: 2,
        updatedAt: new Date(),
      });
      const oldBlob = Buffer.from(DATA_1);
      blobStorage.load.mockResolvedValue(makeVersion(1, oldBlob));
      blobStorage.store.mockResolvedValue(makeVersion(3, oldBlob));

      const result = await service.restore('user-1', 'vault-1', 'file-1', 1);

      expect(blobStorage.store).toHaveBeenCalledWith(
        transactionManager,
        'file-1',
        3,
        expect.objectContaining({ data: oldBlob, iv: 'AAAAAAAAAAAAAAAA' }),
      );
      expect(result.version.versionNo).toBe(3);
      expect(result.file.currentVersionNo).toBe(3);
    });

    it('throws NotFound when the source version does not exist', async () => {
      fileRepository.findOne.mockResolvedValue({
        id: 'file-1',
        currentVersionNo: 2,
      });
      blobStorage.load.mockResolvedValue(null);
      await expect(
        service.restore('user-1', 'vault-1', 'file-1', 99),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listVersions', () => {
    it('returns version metadata without blobs', async () => {
      fileRepository.findOne.mockResolvedValue({
        id: 'file-1',
        currentVersionNo: 2,
      });
      dataSource.manager.find.mockResolvedValue([
        makeVersion(2, Buffer.from(DATA_2)),
        makeVersion(1, Buffer.from(DATA_1)),
      ]);

      const versions = await service.listVersions(
        'user-1',
        'vault-1',
        'file-1',
      );
      expect(versions).toHaveLength(2);
      expect(versions[0]).not.toHaveProperty('blob');
      expect(versions[0].versionNo).toBe(2);
    });
  });

  describe('findVersion', () => {
    it('throws NotFound when the version is missing', async () => {
      fileRepository.findOne.mockResolvedValue({
        id: 'file-1',
        currentVersionNo: 2,
      });
      blobStorage.load.mockResolvedValue(null);
      await expect(
        service.findVersion('user-1', 'vault-1', 'file-1', 5),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
