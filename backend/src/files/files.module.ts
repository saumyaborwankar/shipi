import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { File } from './file.entity';
import { FileVersion } from './file-version.entity';
import { BlobStorageService } from './blob-storage.service';
import { PostgresBlobStorageService } from './postgres-blob-storage.service';
import { VaultsModule } from '../vaults/vaults.module';

@Module({
  imports: [TypeOrmModule.forFeature([File, FileVersion]), VaultsModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    { provide: BlobStorageService, useClass: PostgresBlobStorageService },
  ],
})
export class FilesModule {}
