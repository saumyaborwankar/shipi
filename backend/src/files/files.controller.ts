import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  FilesService,
  FileResponse,
  VersionEnvelope,
  VersionMeta,
} from './files.service';
import { UpsertFileDto } from './dto/upsert-file.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('vaults/:vaultId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Put()
  upsert(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
    @Body() dto: UpsertFileDto,
  ): Promise<VersionEnvelope> {
    return this.filesService.upsert(user.id, vaultId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
  ): Promise<FileResponse[]> {
    return this.filesService.findAll(user.id, vaultId);
  }

  @Get(':fileId')
  findLatest(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
    @Param('fileId') fileId: string,
  ): Promise<VersionEnvelope> {
    return this.filesService.findLatest(user.id, vaultId, fileId);
  }

  @Get(':fileId/versions')
  listVersions(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
    @Param('fileId') fileId: string,
  ): Promise<VersionMeta[]> {
    return this.filesService.listVersions(user.id, vaultId, fileId);
  }

  @Get(':fileId/versions/:versionNo')
  findVersion(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
    @Param('fileId') fileId: string,
    @Param('versionNo', ParseIntPipe) versionNo: number,
  ): Promise<VersionEnvelope> {
    return this.filesService.findVersion(user.id, vaultId, fileId, versionNo);
  }

  @Post(':fileId/restore/:versionNo')
  restore(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
    @Param('fileId') fileId: string,
    @Param('versionNo', ParseIntPipe) versionNo: number,
  ): Promise<VersionEnvelope> {
    return this.filesService.restore(user.id, vaultId, fileId, versionNo);
  }

  @Delete(':fileId')
  remove(
    @CurrentUser() user: { id: string },
    @Param('vaultId') vaultId: string,
    @Param('fileId') fileId: string,
  ): Promise<void> {
    return this.filesService.remove(user.id, vaultId, fileId);
  }
}
