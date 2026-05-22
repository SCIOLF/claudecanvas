import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalCard } from '../components/Sidebar/TerminalCard';
import type { TerminalConfig } from '../types';

const config: TerminalConfig = {
  id: 'id-1',
  label: 'projet-api',
  dir: '/home/user/api',
  color: '#58a6ff',
};

vi.mock('../hooks/useTerminalEvents', () => ({
  useTerminalEvents: vi.fn(),
}));

// Mock xterm Terminal pour éviter les erreurs DOM dans les tests
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(function () {
    return {
      open: vi.fn(),
      write: vi.fn(),
      dispose: vi.fn(),
      loadAddon: vi.fn(),
    };
  }),
}));

describe('TerminalCard', () => {
  it('affiche le label du terminal', () => {
    render(<TerminalCard config={config} status="active" isActive={false} onClick={() => {}} />);
    expect(screen.getByText('projet-api')).toBeInTheDocument();
  });

  it('affiche le badge "actif" en vert pour status=active', () => {
    render(<TerminalCard config={config} status="active" isActive={false} onClick={() => {}} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: '#3fb950' });
  });

  it('affiche le badge en orange pour status=waiting', () => {
    render(<TerminalCard config={config} status="waiting" isActive={false} onClick={() => {}} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: '#e3b341' });
  });

  it('affiche le badge en rouge pour status=error', () => {
    render(<TerminalCard config={config} status="error" isActive={false} onClick={() => {}} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: '#f85149' });
  });

  it('applique la bordure active quand isActive=true', () => {
    const { container } = render(
      <TerminalCard config={config} status="active" isActive={true} onClick={() => {}} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveStyle({ borderColor: '#58a6ff' });
  });

  it('appelle onClick au clic', async () => {
    const onClick = vi.fn();
    render(<TerminalCard config={config} status="active" isActive={false} onClick={onClick} />);
    await userEvent.click(screen.getByText('projet-api'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
