import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, MinLength, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RequestType } from '@prisma/client';

export class CreateProcurementDto {
  @IsEnum(RequestType)
  requestType: RequestType;

  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  businessNeed?: string;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  budgetEstimate?: number;

  @IsString()
  @IsOptional()
  justification?: string;

  @IsArray()
  @IsOptional()
  fileIds?: string[];
}

export class UpdateProcurementDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  businessNeed?: string;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  budgetEstimate?: number;

  @IsString()
  @IsOptional()
  justification?: string;
}

export class QueryProcurementDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(RequestType)
  requestType?: RequestType;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMax?: number;
}

export class ReviewDto {
  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class PublishDto {
  @IsDateString()
  @IsOptional()
  submissionDeadline?: string;
}

export class FinalDecisionDto {
  @IsString()
  @IsOptional()
  finalDecisionReason?: string;
}
