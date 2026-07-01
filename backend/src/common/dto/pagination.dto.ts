import { IsOptional, IsString, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  locked?: boolean;
}
