import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VaultsService } from './vaults.service';
import { CreateVaultDto } from './dto/create-vault.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Vault } from './vault.entity';

@Controller('vaults')
@UseGuards(JwtAuthGuard)
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateVaultDto,
  ): Promise<Vault> {
    return this.vaultsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }): Promise<Vault[]> {
    return this.vaultsService.findAll(user.id);
  }

  @Get(':vaultId')
  findOne(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
  ): Promise<Vault> {
    return this.vaultsService.findOwned(user.id, vaultId);
  }

  @Delete(':vaultId')
  remove(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
  ): Promise<void> {
    return this.vaultsService.remove(user.id, vaultId);
  }
}
