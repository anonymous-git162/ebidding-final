import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('FilesController', () => {
  let controller: FilesController;
  let service: jest.Mocked<FilesService>;

  const mockReq = { user: { id: 'user-1', role: 'REQUESTER' } };

  beforeEach(async () => {
    service = {
      upload: jest.fn(),
      getFile: jest.fn(),
      downloadFile: jest.fn(),
      listFiles: jest.fn(),
      deleteFile: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<FilesController>(FilesController);
  });

  it('should upload a file', async () => {
    const mockFile = {
      buffer: Buffer.from('test'),
      mimetype: 'application/pdf',
      size: 1024,
    } as Express.Multer.File;
    const expected = { id: 'f-1', fileName: 'test.pdf' };
    service.upload.mockResolvedValue(expected as any);

    const result = await controller.upload(mockFile, mockReq);
    expect(service.upload).toHaveBeenCalledWith(mockFile, mockReq.user.id);
    expect(result).toBe(expected);
  });

  it('should list files', async () => {
    const expected = [{ id: 'f-1', fileName: 'test.pdf' }];
    service.listFiles.mockResolvedValue(expected as any);

    const result = await controller.list(mockReq);
    expect(service.listFiles).toHaveBeenCalledWith(mockReq.user.id);
    expect(result).toBe(expected);
  });

  it('should download a file', async () => {
    service.downloadFile.mockResolvedValue({ buffer: Buffer.from('test'), contentType: 'application/pdf', fileName: 'test.pdf' });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await controller.download('f-1', mockReq, res);
    expect(service.downloadFile).toHaveBeenCalledWith('f-1', mockReq.user.id, mockReq.user.role);
  });

  it('should delete a file', async () => {
    service.deleteFile.mockResolvedValue({ id: 'f-1' } as any);

    const result = await controller.remove('f-1', mockReq);
    expect(service.deleteFile).toHaveBeenCalledWith('f-1', mockReq.user.id);
    expect(result).toEqual({ message: 'File deleted' });
  });

  it('should return 404 when file not found on download', async () => {
    service.downloadFile.mockResolvedValue(null);

    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.download('nonexistent', mockReq, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'File not found' });
  });
});
