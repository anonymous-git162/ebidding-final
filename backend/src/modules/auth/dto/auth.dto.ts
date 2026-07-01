import { IsEmail, IsString, MinLength, IsEnum, IsOptional, Matches } from 'class-validator';
import { UserRole } from '@prisma/client';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  fullName: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.REQUESTER;
}
