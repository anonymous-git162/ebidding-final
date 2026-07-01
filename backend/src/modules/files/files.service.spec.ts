import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { FilesService } from './files.service';
import { PrismaService } from '../../database/prisma.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

jest.mock('fs');

describe('FilesService', () => {
  let service: FilesService;
  let prisma: MockPrisma;

  const mockFile = {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test content'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  beforeEach(async () => {
    prisma = mockPrisma();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  describe('upload', () => {
    it('should accept a valid PDF file', async () => {
      prisma.file.create.mockResolvedValue({
        id: 'file-1', fileName: 'test.pdf', mimeType: 'application/pdf', fileSize: 1024, storagePath: '/uploads/123-test.pdf', uploadedBy: 'user-1',
      });

      const result = await service.upload(mockFile, 'user-1');
      expect(result).toHaveProperty('id', 'file-1');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should reject unsupported MIME types', async () => {
      const exeFile = { ...mockFile, mimetype: 'application/x-msdownload', originalname: 'virus.exe' };

      await expect(service.upload(exeFile as any, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject files exceeding 10MB', async () => {
      const largeFile = { ...mockFile, size: 11 * 1024 * 1024 };

      await expect(service.upload(largeFile as any, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should reject null file', async () => {
      await expect(service.upload(null as any, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should sanitize filename to prevent path traversal', async () => {
      const traversalFile = { ...mockFile, originalname: '../../../etc/passwd' };
      prisma.file.create.mockResolvedValue({ id: 'file-1', fileName: '../../../etc/passwd' } as any);

      const result = await service.upload(traversalFile as any, 'user-1');

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenPath = (fs.writeFileSync as jest.Mock).mock.calls[0][0];
      expect(writtenPath).not.toContain('..');
      expect(writtenPath).not.toContain('/etc/');
    });
  });

  describe('getFile', () => {
    it('should return file for the uploader', async () => {
      prisma.file.findUnique.mockResolvedValue({ id: 'file-1', uploadedBy: 'user-1' });

      const result = await service.getFile('file-1', 'user-1');
      expect(result).not.toBeNull();
    });

    it('should return null for wrong user', async () => {
      prisma.file.findUnique.mockResolvedValue({ id: 'file-1', uploadedBy: 'user-1' });

      const result = await service.getFile('file-1', 'user-2');
      expect(result).toBeNull();
    });

    it('should return null for non-existent file', async () => {
      prisma.file.findUnique.mockResolvedValue(null);

      const result = await service.getFile('non-existent', 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('should delete file and database record', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);
      prisma.file.findUnique.mockResolvedValue({ id: 'file-1', storagePath: '/tmp/test.pdf', uploadedBy: 'user-1' });
      prisma.file.delete.mockResolvedValue({});

      const result = await service.deleteFile('file-1', 'user-1');
      expect(result).not.toBeNull();
      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.pdf');
    });

    it('should return null for non-existent file', async () => {
      prisma.file.findUnique.mockResolvedValue(null);

      const result = await service.deleteFile('non-existent', 'user-1');
      expect(result).toBeNull();
    });

    it('should not delete if user does not own the file', async () => {
      prisma.file.findUnique.mockResolvedValue({ id: 'file-1', storagePath: '/tmp/test.pdf', uploadedBy: 'user-1' });

      const result = await service.deleteFile('file-1', 'user-2');
      expect(result).toBeNull();
    });
  });
});
