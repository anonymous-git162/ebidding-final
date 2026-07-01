import { Controller, Post, Get, Delete, Param, Request, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { Response } from 'express';
import * as fs from 'fs';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  upload(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.filesService.upload(file, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List files for current user' })
  list(@Request() req: any) {
    return this.filesService.listFiles(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download a file' })
  async download(@Param('id') id: string, @Request() req: any, @Res() res: any) {
    const file = await this.filesService.getFile(id, req.user.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    if (fs.existsSync(file.storagePath)) {
      const isText = file.mimeType.startsWith('text/') || file.mimeType === 'application/json';
      const contentType = isText ? `${file.mimeType}; charset=utf-8` : file.mimeType;
      res.setHeader('Content-Type', contentType);

      const encodedName = encodeURIComponent(file.fileName);
      const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);

      fs.createReadStream(file.storagePath).pipe(res);
    } else {
      res.status(404).json({ message: 'File not found on disk' });
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const file = await this.filesService.deleteFile(id, req.user.id);
    if (!file) return { message: 'File not found' };
    return { message: 'File deleted' };
  }
}
