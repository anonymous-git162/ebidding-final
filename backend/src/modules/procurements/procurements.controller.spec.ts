import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementsController } from './procurements.controller';
import { ProcurementsService } from './procurements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';

describe('ProcurementsController', () => {
  let controller: ProcurementsController;
  let service: jest.Mocked<ProcurementsService>;

  const mockUser = { id: 'user-1', role: 'REQUESTER' };
  const mockReq = { user: mockUser };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      submit: jest.fn(),
      startReview: jest.fn(),
      approveReview: jest.fn(),
      returnReview: jest.fn(),
      rejectReview: jest.fn(),
      publish: jest.fn(),
      cancel: jest.fn(),
      closeRfi: jest.fn(),
      draftRfp: jest.fn(),
      completeVendorResponse: jest.fn(),
      startEbidding: jest.fn(),
      completeEbidding: jest.fn(),
      completeEvaluation: jest.fn(),
      approveProcurement: jest.fn(),
      announceAward: jest.fn(),
      completeProcurement: jest.fn(),
      getStats: jest.fn(),
      getCurrencies: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementsController],
      providers: [
        { provide: ProcurementsService, useValue: service },
        { provide: PrismaService, useValue: { procurement: { update: jest.fn() } } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ProcurementsController>(ProcurementsController);
  });

  it('should get stats', async () => {
    const expected = { total: 10 };
    service.getStats.mockResolvedValue(expected as any);
    expect(await controller.getStats()).toBe(expected);
  });

  it('should get currencies', async () => {
    const expected = ['USD', 'THB'];
    service.getCurrencies.mockResolvedValue(expected as any);
    expect(await controller.getCurrencies()).toBe(expected);
  });

  it('should create', async () => {
    const dto = {
      requestType: 'RFP' as const,
      title: 'Test',
      budgetEstimate: 1000,
    };
    const expected = { id: 'p-1', ...dto };
    service.create.mockResolvedValue(expected as any);

    const result = await controller.create(dto, mockReq);
    expect(service.create).toHaveBeenCalledWith(dto, mockUser.id);
    expect(result).toBe(expected);
  });

  it('should findAll', async () => {
    const query = { status: 'DRAFT' };
    const expected = [{ id: 'p-1' }];
    service.findAll.mockResolvedValue(expected as any);

    const result = await controller.findAll(query, mockReq);
    expect(service.findAll).toHaveBeenCalledWith(query, mockUser);
    expect(result).toBe(expected);
  });

  it('should findOne', async () => {
    const expected = { id: 'p-1' };
    service.findById.mockResolvedValue(expected as any);

    const result = await controller.findOne('p-1', mockReq);
    expect(service.findById).toHaveBeenCalledWith('p-1', mockUser);
    expect(result).toBe(expected);
  });

  it('should update', async () => {
    const dto = { title: 'Updated' };
    const expected = { id: 'p-1', title: 'Updated' };
    service.update.mockResolvedValue(expected as any);

    const result = await controller.update('p-1', dto, mockReq);
    expect(service.update).toHaveBeenCalledWith('p-1', dto, mockUser.id);
    expect(result).toBe(expected);
  });

  it('should submit', async () => {
    const expected = { id: 'p-1', status: 'SUBMITTED' };
    service.submit.mockResolvedValue(expected as any);

    const result = await controller.submit('p-1', mockReq);
    expect(service.submit).toHaveBeenCalledWith('p-1', mockUser.id);
    expect(result).toBe(expected);
  });

  it('should startReview', async () => {
    service.startReview.mockResolvedValue({
      status: 'UNDER_PROCUREMENT_REVIEW',
    } as any);
    await controller.startReview('p-1', mockReq);
    expect(service.startReview).toHaveBeenCalledWith('p-1', mockUser.id);
  });

  it('should approveReview', async () => {
    const dto = { comment: 'Looks good' };
    service.approveReview.mockResolvedValue({ status: 'APPROVED' } as any);
    await controller.approveReview('p-1', dto, mockReq);
    expect(service.approveReview).toHaveBeenCalledWith(
      'p-1',
      mockUser.id,
      dto.comment,
    );
  });

  it('should returnReview', async () => {
    const dto = { reason: 'Needs work' };
    service.returnReview.mockResolvedValue({
      status: 'RETURNED_FOR_REVISION',
    } as any);
    await controller.returnReview('p-1', dto, mockReq);
    expect(service.returnReview).toHaveBeenCalledWith(
      'p-1',
      mockUser.id,
      dto.reason,
    );
  });

  it('should rejectReview', async () => {
    const dto = { reason: 'Not suitable' };
    service.rejectReview.mockResolvedValue({ status: 'REJECTED' } as any);
    await controller.rejectReview('p-1', dto, mockReq);
    expect(service.rejectReview).toHaveBeenCalledWith(
      'p-1',
      mockUser.id,
      dto.reason,
    );
  });

  it('should publish', async () => {
    const dto = { submissionDeadline: '2026-12-31T00:00:00Z' };
    service.publish.mockResolvedValue({ status: 'RFP_PUBLISHED' } as any);
    await controller.publish('p-1', dto, mockReq);
    expect(service.publish).toHaveBeenCalledWith(
      'p-1',
      mockUser.id,
      dto.submissionDeadline,
    );
  });

  it('should cancel', async () => {
    const dto = { reason: 'Cancelled' };
    service.cancel.mockResolvedValue({ status: 'CANCELLED' } as any);
    await controller.cancel('p-1', dto, mockReq);
    expect(service.cancel).toHaveBeenCalledWith('p-1', mockUser.id, dto.reason);
  });

  it('should closeRfi', async () => {
    service.closeRfi.mockResolvedValue({ status: 'RFI_CLOSED' } as any);
    await controller.closeRfi('p-1', mockReq);
    expect(service.closeRfi).toHaveBeenCalledWith('p-1', mockUser.id);
  });

  it('should draftRfp', async () => {
    service.draftRfp.mockResolvedValue({ status: 'RFP_DRAFTING' } as any);
    await controller.draftRfp('p-1', mockReq);
    expect(service.draftRfp).toHaveBeenCalledWith('p-1', mockUser.id);
  });

  it('should completeVendorResponse', async () => {
    service.completeVendorResponse.mockResolvedValue({
      status: 'VENDOR_RESPONSE_COMPLETE',
    } as any);
    await controller.completeVendorResponse('p-1', mockReq);
    expect(service.completeVendorResponse).toHaveBeenCalledWith(
      'p-1',
      mockUser.id,
    );
  });

  it('should startEbidding', async () => {
    service.startEbidding.mockResolvedValue({
      status: 'VENDOR_RESPONSE_IN_PROGRESS',
    } as any);
    await controller.startEbidding('p-1', mockReq);
    expect(service.startEbidding).toHaveBeenCalledWith('p-1', mockUser.id);
  });

  it('should completeEbidding', async () => {
    service.completeEbidding.mockResolvedValue({ status: 'EVALUATION' } as any);
    await controller.completeEbidding('p-1', mockReq);
    expect(service.completeEbidding).toHaveBeenCalledWith('p-1', mockUser.id);
  });

  it('should completeEvaluation', async () => {
    service.completeEvaluation.mockResolvedValue({
      status: 'AWAITING_APPROVAL',
    } as any);
    await controller.completeEvaluation('p-1', mockReq);
    expect(service.completeEvaluation).toHaveBeenCalledWith('p-1', mockUser.id);
  });

  it('should approveProcurement', async () => {
    const dto = { comment: 'Final approved' };
    service.approveProcurement.mockResolvedValue({ status: 'APPROVED' } as any);
    await controller.approveProcurement('p-1', dto, mockReq);
    expect(service.approveProcurement).toHaveBeenCalledWith(
      'p-1',
      mockUser.id,
      dto.comment,
    );
  });

  it('should announceAward', async () => {
    const body = { winningVendorId: 'v-1', announcementText: 'Winner!' };
    service.announceAward.mockResolvedValue({ status: 'AWARDED' } as any);
    await controller.announceAward('p-1', body, mockReq);
    expect(service.announceAward).toHaveBeenCalledWith(
      'p-1',
      mockUser.id,
      body.winningVendorId,
      body.announcementText,
    );
  });

  it('should completeProcurement', async () => {
    service.completeProcurement.mockResolvedValue({
      status: 'COMPLETED',
    } as any);
    await controller.completeProcurement('p-1', mockReq);
    expect(service.completeProcurement).toHaveBeenCalledWith(
      'p-1',
      mockUser.id,
    );
  });
});
