import { render, screen } from '@testing-library/react';
import { Icon } from '../components/Icon';

describe('Icon', () => {
  it('renders an icon by name', () => {
    const { container } = render(<Icon name="Dashboard" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('returns null for unknown icon name', () => {
    const { container } = render(<Icon name="NonExistent" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('accepts custom fontSize', () => {
    const { container } = render(<Icon name="Add" fontSize="32px" />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.fontSize).toBe('32px');
  });

  it('accepts sx styles', () => {
    const { container } = render(<Icon name="Gavel" sx={{ color: 'red' }} />);
    const span = container.firstChild as HTMLElement;
    expect(span.style.color).toBe('red');
  });
});
