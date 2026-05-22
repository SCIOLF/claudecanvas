import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { MainPanel } from '../components/MainPanel/MainPanel';
import { useTerminalStore } from '../store/terminalStore';
import type { TerminalConfig } from '../types';

vi.mock('../hooks/useTerminalEvents', () => ({
  useTerminalEvents: vi.fn(),
}));

// Mock xterm + addon-fit
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(function() {
    return {
      open: vi.fn(),
      write: vi.fn(),
      dispose: vi.fn(),
      loadAddon: vi.fn(),
    };
  }),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(function() {
    return {
      fit: vi.fn(),
    };
  }),
}));

const config: TerminalConfig = {
  id: 'id-1',
  label: 'api',
  dir: '/tmp',
  color: '#58a6ff',
};

beforeEach(() => {
  useTerminalStore.setState({
    terminals: [config],
    activeTerminalId: 'id-1',
    statuses: { 'id-1': 'active' },
  });
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('MainPanel', () => {
  it('affiche un message quand aucun terminal actif', () => {
    useTerminalStore.setState({ activeTerminalId: null, terminals: [], statuses: {} });
    render(<MainPanel />);
    expect(screen.getByText(/aucun terminal/i)).toBeInTheDocument();
  });

  it('affiche le label du terminal actif', () => {
    render(<MainPanel />);
    expect(screen.getAllByText('api').length).toBeGreaterThan(0);
  });

  it('envoie l\'input via invoke send_input en mode Terminal', async () => {
    render(<MainPanel />);
    const input = screen.getByPlaceholderText(/tapez/i);
    fireEvent.change(input, { target: { value: 'y' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer/i }));
    expect(invoke).toHaveBeenCalledWith('send_input', { id: 'id-1', data: 'y\n' });
  });
});
