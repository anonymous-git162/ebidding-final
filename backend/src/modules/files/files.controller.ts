import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Request,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';


@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  async download(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: any,
  ) {
    const result = await this.filesService.downloadFile(id, req.user.id, req.user.role);
    if (!result) return res.status(404).json({ message: 'File not found' });
    if ('error' in result) return res.status(502).json({ message: result.error });
    if ('redirect' in result) return res.redirect(result.redirect);

    res.setHeader('Content-Type', result.contentType);
    const encodedName = encodeURIComponent(result.fileName);
    const asciiName = result.fileName.replace(/[^\x20-\x7E]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', result.buffer.length);
    return res.send(result.buffer);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const file = await this.filesService.deleteFile(id, req.user.id);
    if (!file) return { message: 'File not found' };
    return { message: 'File deleted' };
  }
}
