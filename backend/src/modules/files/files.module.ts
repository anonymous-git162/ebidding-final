import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [
    MulterModule.register({
      storage: undefined,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const buf = Buffer.from(file.originalname, 'latin1');
        file.originalname = buf.toString('utf8');
        cb(null, true);
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
