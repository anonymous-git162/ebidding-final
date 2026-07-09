import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { validateMagicBytes } from '../../common/helpers/magic-bytes';
import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async upload(file: Express.Multer.File, uploadedBy: string) {
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }
    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'File content does not match declared file type',
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    let decodedName = path.basename(file.originalname);
    try {
      decodedName = decodeURIComponent(path.basename(file.originalname));
    } catch { /* empty */ }
    const safeName = decodedName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    return this.prisma.file.create({
      data: {
        fileName: decodedName,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath: filePath,
        uploadedBy,
      },
    });
  }

  async getFile(id: string, userId?: string, userRole?: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) return null;
    if (userId && file.uploadedBy !== userId && userRole !== 'PROCUREMENT' && userRole !== 'ADMIN') return null;
    return file;
  }

  async listFiles(userId: string) {
    return this.prisma.file.findMany({
      where: { uploadedBy: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  }

  async deleteFile(id: string, userId?: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) return null;
    if (userId && file.uploadedBy !== userId) return null;
    if (fs.existsSync(file.storagePath)) fs.unlinkSync(file.storagePath);
    await this.prisma.file.delete({ where: { id } });
    return file;
  }
}
