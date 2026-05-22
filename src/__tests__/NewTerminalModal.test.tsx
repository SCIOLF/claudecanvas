import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { NewTerminalModal } from '../components/NewTerminalModal';
import { useTerminalStore } from '../store/terminalStore';

beforeEach(() => {
  useTerminalStore.setState({ terminals: [], activeTerminalId: null, statuses: {} });
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('NewTerminalModal', () => {
  it('affiche le formulaire de création', () => {
    render(<NewTerminalModal onClose={() => {}} />);
    expect(screen.getByLabelText(/répertoire/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
  });

  it('désactive le bouton Créer si répertoire vide', () => {
    render(<NewTerminalModal onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /créer/i });
    expect(btn).toBeDisabled();
  });

  it('désactive le bouton Créer si label vide', async () => {
    render(<NewTerminalModal onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/répertoire/i), '/tmp');
    const btn = screen.getByRole('button', { name: /créer/i });
    expect(btn).toBeDisabled();
  });

  it('appelle invoke spawn_terminal avec les bons paramètres', async () => {
    render(<NewTerminalModal onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/répertoire/i), '/home/user');
    await userEvent.type(screen.getByLabelText(/label/i), 'mon-projet');
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    expect(invoke).toHaveBeenCalledWith('spawn_terminal', expect.objectContaining({
      dir: '/home/user',
      label: 'mon-projet',
    }));
  });

  it('appelle onClose après création réussie', async () => {
    const onClose = vi.fn();
    render(<NewTerminalModal onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/répertoire/i), '/tmp');
    await userEvent.type(screen.getByLabelText(/label/i), 'test');
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
