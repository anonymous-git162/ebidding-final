import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'List all users with pagination' })
  findAll(@Query() dto: PaginationDto, @Request() req: any) {
    return this.usersService.findAll(dto, req.user.role);
  }

  @Get('properties')
  @ApiOperation({ summary: 'List all properties with departments' })
  getProperties() {
    return this.usersService.getProperties();
  }

  @Get('departments/:propertyId')
  @ApiOperation({ summary: 'List departments for a property' })
  getDepartments(@Param('propertyId') propertyId: string) {
    return this.usersService.getDepartments(propertyId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() body: { email: string; password: string; fullName: string; role: UserRole; propertyId?: string; departmentId?: string; managerId?: string }) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() body: { email?: string; fullName?: string; role?: UserRole; isActive?: boolean; propertyId?: string; departmentId?: string; managerId?: string; password?: string }) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate user' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reset user password' })
  resetPassword(@Param('id') id: string, @Body() body: { password: string }) {
    return this.usersService.resetPassword(id, body.password);
  }

  @Post(':id/unlock')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Unlock a locked user account' })
  unlock(@Param('id') id: string) {
    return this.usersService.unlock(id);
  }
}
