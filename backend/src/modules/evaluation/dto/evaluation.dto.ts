import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { stripHtml } from '../../../common/helpers/sanitize';

const Sanitize = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? stripHtml(value) : value,
  );

export class AssignDto {
  @IsString()
  procurementId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  evaluatorIds: string[];

  @IsString()
  leadEvaluatorId: string;
}

export class SubmitReviewDto {
  @IsString()
  procurementId: string;

  @IsString()
  vendorId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @Sanitize()
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  criterionScores?: { criteriaIndex: number; score: number }[];
}

export class CriterionDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  weight: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxScore?: number;
}

export class SetCriteriaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria: CriterionDto[];
}

export class ConsolidateDto {
  @Sanitize()
  @IsString()
  recommendation: string;

  @Sanitize()
  @IsString()
  leadCommentary: string;
}
