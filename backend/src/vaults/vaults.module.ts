import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VaultsService } from './vaults.service';
import { VaultsController } from './vaults.controller';
import { Vault } from './vault.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vault])],
  controllers: [VaultsController],
  providers: [VaultsService],
  exports: [VaultsService],
})
export class VaultsModule {}
