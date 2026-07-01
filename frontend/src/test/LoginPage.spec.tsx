import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../pages/LoginPage';
import { useAuth } from '../contexts/AuthContext';
import { MemoryRouter } from 'react-router-dom';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      login: mockLogin,
      user: null,
      isLoading: false,
    });
  });

  it('renders welcome heading and form fields', () => {
    renderPage();
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('calls login and navigates on successful submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'Password123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'bad@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows generic error if no response message', async () => {
    mockLogin.mockRejectedValue(new Error('Network error'));
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('shows loading state while submitting', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}));
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  });

  it('toggles password visibility', async () => {
    renderPage();
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
