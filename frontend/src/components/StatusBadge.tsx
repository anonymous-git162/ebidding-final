import { Chip } from '@mui/material';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error' | 'primary'> = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  UNDER_PROCUREMENT_REVIEW: 'warning',
  RETURNED_FOR_REVISION: 'error',
  APPROVED: 'success',
  RFP_PUBLISHED: 'primary',
  RFQ_OPEN: 'primary',
  VENDOR_RESPONSE_IN_PROGRESS: 'info',
  BIDDING_OPEN: 'primary',
  BIDDING_CLOSED: 'default',
  UNDER_EVALUATION: 'warning',
  PENDING_APPROVAL: 'warning',
  RETURNED_FROM_APPROVAL: 'error',
  COMPLETED: 'success',
  REJECTED: 'error',
  CANCELLED: 'error',
  PENDING: 'default',
  ACCEPTED: 'success',
  DECLINED: 'error',
  EXPIRED: 'error',
  OPEN: 'success',
  CLOSED: 'default',
  DRAFT_SUB: 'default',
  SUBMITTED_SUB: 'info',
  REVISION_REQUESTED: 'error',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_PROCUREMENT_REVIEW: 'Under Review',
  RETURNED_FOR_REVISION: 'Returned',
  APPROVED: 'Approved',
  RFP_PUBLISHED: 'RFP Published',
  RFQ_OPEN: 'RFQ Open',
  VENDOR_RESPONSE_IN_PROGRESS: 'Vendors Responding',
  BIDDING_OPEN: 'Bidding Open',
  BIDDING_CLOSED: 'Bidding Closed',
  UNDER_EVALUATION: 'Under Evaluation',
  PENDING_APPROVAL: 'Pending Approval',
  RETURNED_FROM_APPROVAL: 'Returned',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Chip
      label={STATUS_LABELS[status] || status}
      color={STATUS_COLORS[status] || 'default'}
      size="small"
      variant="outlined"
    />
  );
}
