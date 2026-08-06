import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VaultsService } from './vaults.service';
import { Vault } from './vault.entity';

describe('VaultsService', () => {
  let service: VaultsService;
  const vaultRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultsService,
        { provide: getRepositoryToken(Vault), useValue: vaultRepository },
      ],
    }).compile();

    service = module.get<VaultsService>(VaultsService);
  });

  it('creates a vault owned by the given user', async () => {
    vaultRepository.create.mockImplementation((dto: Partial<Vault>) => dto);
    vaultRepository.save.mockResolvedValue({
      id: 'v1',
      ownerId: 'u1',
      name: 'Work',
    });

    const vault = await service.create('u1', {
      name: 'Work',
      keyFingerprint: 'a'.repeat(64),
    });

    expect(vaultRepository.save).toHaveBeenCalledWith({
      ownerId: 'u1',
      name: 'Work',
      keyFingerprint: 'a'.repeat(64),
    });
    expect(vault.id).toBe('v1');
  });

  it('finds only vaults owned by the user', async () => {
    vaultRepository.find.mockResolvedValue([{ id: 'v1' }]);
    const vaults = await service.findAll('u1');
    expect(vaultRepository.find).toHaveBeenCalledWith({
      where: { ownerId: 'u1' },
      order: { createdAt: 'DESC' },
    });
    expect(vaults).toHaveLength(1);
  });

  it('returns a vault only if owned by the user', async () => {
    vaultRepository.findOne.mockResolvedValue({ id: 'v1', ownerId: 'u1' });
    await expect(service.findOwned('u1', 'v1')).resolves.toEqual({
      id: 'v1',
      ownerId: 'u1',
    });
  });

  it('throws NotFound when the vault is not owned by the user', async () => {
    vaultRepository.findOne.mockResolvedValue(null);
    await expect(service.findOwned('u1', 'v1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
