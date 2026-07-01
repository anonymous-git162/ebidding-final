export { ProcurementStatus } from '@prisma/client';
export { CurrentOwnerRole } from '@prisma/client';
export { RequestType } from '@prisma/client';
export { UserRole } from '@prisma/client';
export { VendorStatus } from '@prisma/client';
export { InvitationStatus } from '@prisma/client';
export { SubmissionStatus } from '@prisma/client';
export { EbiddingRoundStatus } from '@prisma/client';
export { ApprovalDecision } from '@prisma/client';

// Flow 1 (Full Loop): RFI → RFP → RFQ → eBidding → Award
// Flow 2 (Standard):   RFP → RFQ → eBidding → Award
// Flow 3 (Quick):      RFQ → eBidding (optional) → Award

export const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  // Phase 1: Request Creation
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_PROCUREMENT_REVIEW', 'CANCELLED'],

  // Phase 2: Procurement Review
  UNDER_PROCUREMENT_REVIEW: ['RETURNED_FOR_REVISION', 'APPROVED', 'REJECTED'],
  RETURNED_FOR_REVISION: ['SUBMITTED', 'CANCELLED'],

  // Phase 3: Publish (varies by request type)
  APPROVED: ['RFI_PUBLISHED', 'RFP_PUBLISHED', 'RFQ_OPEN', 'CANCELLED'],

  // RFI Flow (Phase 3a)
  RFI_PUBLISHED: ['RFI_COLLECTING', 'CANCELLED'],
  RFI_COLLECTING: ['RFI_CLOSED', 'CANCELLED'],
  RFI_CLOSED: ['RFP_DRAFTING', 'CANCELLED'],

  // RFP/RFQ Publishing
  RFP_PUBLISHED: ['VENDOR_RESPONSE_IN_PROGRESS', 'CANCELLED'],
  RFQ_OPEN: ['VENDOR_RESPONSE_IN_PROGRESS', 'CANCELLED'],

  // Phase 4: Vendor Response
  VENDOR_RESPONSE_IN_PROGRESS: ['EBIDDING_PREP', 'EVALUATION', 'CANCELLED'],

  // Phase 5: eBidding (optional)
  EBIDDING_PREP: ['EBIDDING_OPEN', 'EVALUATION', 'CANCELLED'],
  EBIDDING_OPEN: ['EBIDDING_CLOSED', 'CANCELLED'],
  EBIDDING_CLOSED: ['EVALUATION', 'CANCELLED'],

  // Phase 6: Evaluation
  EVALUATION: ['PENDING_APPROVAL', 'CANCELLED'],

  // Phase 7: Approval
  PENDING_APPROVAL: ['RETURNED_FROM_APPROVAL', 'AWARD_APPROVED', 'REJECTED', 'CANCELLED'],
  RETURNED_FROM_APPROVAL: ['PENDING_APPROVAL', 'CANCELLED'],

  // Phase 8: Award
  AWARD_APPROVED: ['AWARD_ANNOUNCED', 'CANCELLED'],
  AWARD_ANNOUNCED: ['COMPLETED'],

  // Terminal states
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

// Get the next statuses allowed from a given status
export function getAllowedTransitions(currentStatus: string): string[] {
  return WORKFLOW_TRANSITIONS[currentStatus] || [];
}

// Check if a transition is valid
export function isValidTransition(from: string, to: string): boolean {
  return getAllowedTransitions(from).includes(to);
}

// Get flow steps based on request type
export function getFlowSteps(requestType: string): string[] {
  if (requestType === 'RFI') {
    return [
      'DRAFT', 'SUBMITTED', 'UNDER_PROCUREMENT_REVIEW', 'APPROVED',
      'RFI_PUBLISHED', 'RFI_COLLECTING', 'RFI_CLOSED', 'RFP_DRAFTING',
      'RFP_PUBLISHED', 'VENDOR_RESPONSE_IN_PROGRESS', 'EBIDDING_OPEN',
      'EVALUATION', 'PENDING_APPROVAL', 'AWARD_APPROVED', 'AWARD_ANNOUNCED', 'COMPLETED',
    ];
  }
  if (requestType === 'RFP') {
    return [
      'DRAFT', 'SUBMITTED', 'UNDER_PROCUREMENT_REVIEW', 'APPROVED',
      'RFP_PUBLISHED', 'VENDOR_RESPONSE_IN_PROGRESS', 'EBIDDING_OPEN',
      'EVALUATION', 'PENDING_APPROVAL', 'AWARD_APPROVED', 'AWARD_ANNOUNCED', 'COMPLETED',
    ];
  }
  // RFQ
  return [
    'DRAFT', 'SUBMITTED', 'UNDER_PROCUREMENT_REVIEW', 'APPROVED',
    'RFQ_OPEN', 'VENDOR_RESPONSE_IN_PROGRESS', 'EBIDDING_OPEN',
    'EVALUATION', 'PENDING_APPROVAL', 'AWARD_APPROVED', 'AWARD_ANNOUNCED', 'COMPLETED',
  ];
}

// Get readable status labels
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_PROCUREMENT_REVIEW: 'Under Review',
  RETURNED_FOR_REVISION: 'Returned for Revision',
  APPROVED: 'Approved',
  RFI_PUBLISHED: 'RFI Published',
  RFI_COLLECTING: 'Collecting Responses',
  RFI_CLOSED: 'RFI Closed',
  RFP_DRAFTING: 'Drafting RFP',
  RFP_PUBLISHED: 'RFP Published',
  RFQ_OPEN: 'RFQ Open',
  VENDOR_RESPONSE_IN_PROGRESS: 'Vendor Response',
  EBIDDING_PREP: 'Preparing Bidding',
  EBIDDING_OPEN: 'eBidding Open',
  EBIDDING_CLOSED: 'eBidding Closed',
  EVALUATION: 'Under Evaluation',
  PENDING_APPROVAL: 'Pending Approval',
  RETURNED_FROM_APPROVAL: 'Returned from Approval',
  AWARD_APPROVED: 'Award Approved',
  AWARD_ANNOUNCED: 'Award Announced',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

// Status colors
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280',
  SUBMITTED: '#2563EB',
  UNDER_PROCUREMENT_REVIEW: '#F59E0B',
  RETURNED_FOR_REVISION: '#EF4444',
  APPROVED: '#10B981',
  RFI_PUBLISHED: '#8B5CF6',
  RFI_COLLECTING: '#8B5CF6',
  RFI_CLOSED: '#6B7280',
  RFP_DRAFTING: '#F59E0B',
  RFP_PUBLISHED: '#2563EB',
  RFQ_OPEN: '#F59E0B',
  VENDOR_RESPONSE_IN_PROGRESS: '#EC4899',
  EBIDDING_PREP: '#F97316',
  EBIDDING_OPEN: '#DC2626',
  EBIDDING_CLOSED: '#6B7280',
  EVALUATION: '#F97316',
  PENDING_APPROVAL: '#F59E0B',
  RETURNED_FROM_APPROVAL: '#EF4444',
  AWARD_APPROVED: '#16A34A',
  AWARD_ANNOUNCED: '#16A34A',
  COMPLETED: '#16A34A',
  REJECTED: '#DC2626',
  CANCELLED: '#6B7280',
};
