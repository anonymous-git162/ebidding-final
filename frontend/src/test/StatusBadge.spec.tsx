import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['DRAFT', 'Draft'],
    ['SUBMITTED', 'Submitted'],
    ['UNDER_PROCUREMENT_REVIEW', 'Under Review'],
    ['RETURNED_FOR_REVISION', 'Returned'],
    ['APPROVED', 'Approved'],
    ['RFP_PUBLISHED', 'RFP Published'],
    ['RFQ_OPEN', 'RFQ Open'],
    ['VENDOR_RESPONSE_IN_PROGRESS', 'Vendors Responding'],
    ['BIDDING_OPEN', 'Bidding Open'],
    ['BIDDING_CLOSED', 'Bidding Closed'],
    ['UNDER_EVALUATION', 'Under Evaluation'],
    ['PENDING_APPROVAL', 'Pending Approval'],
    ['RETURNED_FROM_APPROVAL', 'Returned'],
    ['COMPLETED', 'Completed'],
    ['REJECTED', 'Rejected'],
    ['CANCELLED', 'Cancelled'],
    ['ACCEPTED', 'ACCEPTED'],
    ['DECLINED', 'DECLINED'],
    ['EXPIRED', 'EXPIRED'],
    ['OPEN', 'OPEN'],
    ['CLOSED', 'CLOSED'],
  ])('renders %s as %s', (status, expectedLabel) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it('falls back to raw status string for unknown status', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
  });
});
