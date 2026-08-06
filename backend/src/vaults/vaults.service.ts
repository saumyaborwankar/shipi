import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vault } from './vault.entity';
import { CreateVaultDto } from './dto/create-vault.dto';

@Injectable()
export class VaultsService {
  constructor(
    @InjectRepository(Vault)
    private readonly vaultRepository: Repository<Vault>,
  ) {}

  async create(ownerId: string, dto: CreateVaultDto): Promise<Vault> {
    return this.vaultRepository.save(
      this.vaultRepository.create({ ownerId, ...dto }),
    );
  }

  async findAll(ownerId: string): Promise<Vault[]> {
    return this.vaultRepository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOwned(ownerId: string, vaultId: string): Promise<Vault> {
    const vault = await this.vaultRepository.findOne({
      where: { id: vaultId, ownerId },
    });
    if (!vault) {
      throw new NotFoundException(`Vault ${vaultId} not found`);
    }
    return vault;
  }

  async remove(ownerId: string, vaultId: string): Promise<void> {
    const vault = await this.findOwned(ownerId, vaultId);
    await this.vaultRepository.remove(vault);
  }
}
