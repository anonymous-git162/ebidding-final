import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { validateMagicBytes } from '../../common/helpers/magic-bytes';
import { v2 as cloudinary } from 'cloudinary';
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
  private cloudinaryEnabled = false;

  constructor(private prisma: PrismaService) {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      this.cloudinaryEnabled = true;
    }
  }

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

    let decodedName = path.basename(file.originalname);
    try {
      decodedName = decodeURIComponent(path.basename(file.originalname));
    } catch { /* empty */ }

    let storagePath: string;
    if (this.cloudinaryEnabled) {
      const safeName = decodedName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        { public_id: `${Date.now()}-${safeName}`, access_mode: 'public' },
      );
      storagePath = result.secure_url;
    } else {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const safeName = decodedName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${safeName}`;
      storagePath = path.join(uploadDir, fileName);
      fs.writeFileSync(storagePath, file.buffer);
    }

    return this.prisma.file.create({
      data: {
        fileName: decodedName,
        mimeType: file.mimetype,
        fileSize: file.size,
        storagePath,
        uploadedBy,
      },
    });
  }

  async getFile(id: string, userId?: string, userRole?: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) return null;
    if (userId && file.uploadedBy !== userId && !['PROCUREMENT', 'ADMIN', 'APPROVER', 'EVALUATOR', 'LEAD_EVALUATOR'].includes(userRole || '')) return null;
    return file;
  }

  async downloadFile(id: string, userId?: string, userRole?: string): Promise<{ buffer: Buffer; contentType: string; fileName: string } | { redirect: string } | { error: string } | null> {
    const file = await this.getFile(id, userId, userRole);
    if (!file) return null;

    if (file.storagePath.startsWith('http') && this.cloudinaryEnabled) {
      try {
        const urlObj = new URL(file.storagePath);
        const pathParts = urlObj.pathname.split('/');
        const uploadIdx = pathParts.indexOf('upload');
        if (uploadIdx >= 0 && uploadIdx + 1 < pathParts.length) {
          // For public files, use the public URL directly
          return { redirect: file.storagePath };
        }
      } catch { /* fallback */ }
      return { redirect: file.storagePath };
    }

    if (file.storagePath.startsWith('http')) {
      return { redirect: file.storagePath };
    }

    if (fs.existsSync(file.storagePath)) {
      const buffer = fs.readFileSync(file.storagePath);
      return { buffer, contentType: file.mimeType, fileName: file.fileName };
    }

    return { error: 'File not available' };
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

    if (file.storagePath.startsWith('http')) {
      if (this.cloudinaryEnabled) {
        const urlWithoutQuery = file.storagePath.split('?')[0];
        const parts = urlWithoutQuery.split('/');
        const publicId = parts[parts.length - 1].replace(/\.[^.]+$/, '');
        await cloudinary.uploader.destroy(publicId).catch(() => {});
      }
    } else {
      if (fs.existsSync(file.storagePath)) fs.unlinkSync(file.storagePath);
    }

    await this.prisma.file.delete({ where: { id } });
    return file;
  }
}
