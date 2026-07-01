import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VendorService } from './vendor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, VendorStatus } from '@prisma/client';

@ApiTags('Vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vendors')
export class VendorController {
  constructor(private vendorService: VendorService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Register a new vendor' })
  create(@Body() body: { companyName: string; taxId?: string; contactName: string; contactEmail: string; phone?: string; address?: string; userId?: string }) {
    return this.vendorService.create(body);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'List all vendors' })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number, @Query('search') search?: string) {
    return this.vendorService.findAll(page || 1, limit || 20, search);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Get vendor by ID' })
  findOne(@Param('id') id: string) {
    return this.vendorService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Update vendor' })
  update(@Param('id') id: string, @Body() body: { companyName?: string; taxId?: string; contactName?: string; contactEmail?: string; phone?: string; address?: string; status?: VendorStatus }) {
    return this.vendorService.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete vendor' })
  remove(@Param('id') id: string) {
    return this.vendorService.remove(id);
  }
}
