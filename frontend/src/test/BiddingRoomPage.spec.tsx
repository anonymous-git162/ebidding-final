import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BiddingRoomPage from '../pages/BiddingRoomPage';
import { useAuth } from '../contexts/AuthContext';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../services/api', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockProcurements = [
  { id: 'proc-1', requestNo: 'RFP-001', title: 'Office Supplies', currency: 'USD', budgetEstimate: 50000, submissionDeadline: '2026-12-31T00:00:00.000Z' },
  { id: 'proc-2', requestNo: 'RFQ-002', title: 'IT Equipment', currency: 'THB', budgetEstimate: 200000 },
];

const mockRounds = [
  {
    id: 'round-1',
    roundNo: 1,
    status: 'OPEN',
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: null,
    responses: [
      { vendorId: 'v-1', bidAmount: 1500 },
      { vendorId: 'v-2', bidAmount: 2000 },
    ],
  },
  {
    id: 'round-2',
    roundNo: 2,
    status: 'PENDING',
    startsAt: null,
    endsAt: null,
    responses: [],
  },
];

const mockBids = [
  { id: 'b1', bidAmount: 1500, vendorId: 'v-1', submittedAt: '2026-06-01T12:00:00.000Z', vendor: { id: 'v-1', companyName: 'Vendor A' } },
  { id: 'b2', bidAmount: 2000, vendorId: 'v-2', submittedAt: '2026-06-01T13:00:00.000Z', vendor: { id: 'v-2', companyName: 'Vendor B' } },
];

function renderPage() {
  return render(<BiddingRoomPage />);
}

describe('BiddingRoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: { id: 'user-1', role: 'PROCUREMENT', fullName: 'Proc Officer' },
    });
    mockGet.mockResolvedValue({ data: { data: mockProcurements, total: 2 } });
  });

  it('loads procurements on mount and shows selector', async () => {
    renderPage();
    expect(mockGet).toHaveBeenCalledWith('/procurements', expect.objectContaining({ params: { limit: 50 } }));
    await waitFor(() => {
      expect(screen.getByText('E-Bidding Room')).toBeInTheDocument();
      expect(screen.getByText('RFP-001 - Office Supplies')).toBeInTheDocument();
    });
  });

  it('shows error alert on failed load', async () => {
    mockGet.mockRejectedValue({ response: { data: { message: 'Server error' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('shows generic error message when no response', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('shows empty state when no rounds', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/procurements')) return Promise.resolve({ data: { data: mockProcurements, total: 2 } });
      if (url.startsWith('/ebidding/rounds')) return Promise.resolve({ data: [] });
      return Promise.reject(new Error('Unknown URL'));
    });
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Select Procurement')).toBeInTheDocument());

    const select = screen.getByLabelText('Select Procurement');
    await userEvent.selectOptions(select, 'proc-1');
    await waitFor(() => {
      expect(screen.getByText(/No bidding rounds yet/i)).toBeInTheDocument();
    });
  });

  it('allows PROCUREMENT user to create, open, close rounds', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/procurements')) return Promise.resolve({ data: { data: mockProcurements, total: 2 } });
      if (url.includes('/rounds/procurement')) return Promise.resolve({ data: mockRounds });
      if (url.includes('/my-bids')) return Promise.resolve({ data: [] });
      if (url.includes('/bids')) return Promise.resolve({ data: mockBids });
      return Promise.reject(new Error('Unknown URL'));
    });
    mockPost.mockResolvedValue({ data: mockRounds[0] });

    renderPage();

    await waitFor(() => expect(screen.getByText('RFP-001 - Office Supplies')).toBeInTheDocument());

    const select = screen.getByLabelText('Select Procurement');
    await userEvent.selectOptions(select, 'proc-1');

    await waitFor(() => {
      expect(screen.getByText('Bidding Rounds (2)')).toBeInTheDocument();
      expect(screen.getByText('Round 1')).toBeInTheDocument();
      expect(screen.getByText('Round 2')).toBeInTheDocument();
    });

    // Can see Open button for PENDING round
    expect(screen.getByText('Open')).toBeInTheDocument();

    // Click "Create Round" opens dialog
    await userEvent.click(screen.getByText('Create Round'));
    expect(screen.getByText('Create Bidding Round')).toBeInTheDocument();

    // Confirm creation
    await userEvent.click(screen.getByRole('button', { name: 'Create Round' }));
    expect(mockPost).toHaveBeenCalledWith('/ebidding/rounds', { procurementId: 'proc-1' });
  });

  it('hides Create Round button for non-PROCUREMENT user', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'vendor-user', role: 'VENDOR', fullName: 'Vendor Inc' },
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('RFP-001 - Office Supplies')).toBeInTheDocument();
    });
    expect(screen.queryByText('Create Round')).not.toBeInTheDocument();
  });

  it('shows vendor view with bid submission', async () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'vendor-user', role: 'VENDOR', fullName: 'Vendor Inc' },
    });

    let callCount = 0;
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/procurements')) return Promise.resolve({ data: { data: mockProcurements, total: 2 } });
      if (url.includes('/rounds/procurement')) return Promise.resolve({ data: mockRounds });
      if (url.includes('/my-bids')) {
        callCount++;
        return Promise.resolve({ data: callCount <= 1 ? [] : [{ id: 'my-bid', bidAmount: 1400, vendorId: 'v-1', submittedAt: '2026-06-01T14:00:00.000Z' }] });
      }
      if (url.includes('/bids')) return Promise.resolve({ data: mockBids });
      return Promise.reject(new Error('Unknown URL'));
    });
    mockPost.mockResolvedValue({ data: {} });

    renderPage();

    await waitFor(() => expect(screen.getByText('RFP-001 - Office Supplies')).toBeInTheDocument());

    const select = screen.getByLabelText('Select Procurement');
    await userEvent.selectOptions(select, 'proc-1');

    await waitFor(() => expect(screen.getByText('Round 1')).toBeInTheDocument());

    // Select round
    await userEvent.click(screen.getByText('Round 1'));

    await waitFor(() => {
      // Should show procurement details section
      expect(screen.getByText('Procurement Details')).toBeInTheDocument();
      // Should show My Bids
      expect(screen.getByText(/My Bids \(0\)/)).toBeInTheDocument();
      // Should show place bid form for open rounds
      expect(screen.getByText(/Place New Bid/i)).toBeInTheDocument();
    });

    // Place a bid
    const bidInput = screen.getByLabelText(/Bid Amount/i);
    await userEvent.type(bidInput, '1400');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/ebidding/bid', expect.objectContaining({
        roundId: 'round-1',
        bidAmount: 1400,
      }));
    });
  });

  it('shows admin view with all vendor bids', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.startsWith('/procurements')) return Promise.resolve({ data: { data: mockProcurements, total: 2 } });
      if (url.includes('/rounds/procurement')) return Promise.resolve({ data: mockRounds });
      if (url.includes('/bids')) return Promise.resolve({ data: mockBids });
      return Promise.reject(new Error('Unknown URL'));
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('RFP-001 - Office Supplies')).toBeInTheDocument());

    const select = screen.getByLabelText('Select Procurement');
    await userEvent.selectOptions(select, 'proc-1');

    await waitFor(() => expect(screen.getByText('Round 1')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Round 1'));

    await waitFor(() => {
      expect(screen.getByText(/Vendor Bids \(2\)/)).toBeInTheDocument();
      expect(screen.getByText('Vendor A')).toBeInTheDocument();
      expect(screen.getByText('Vendor B')).toBeInTheDocument();
      expect(screen.getByText('Lowest')).toBeInTheDocument();
    });
  });
});
