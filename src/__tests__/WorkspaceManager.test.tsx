import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { WorkspaceManager } from '../components/WorkspaceManager';
import { useTerminalStore } from '../store/terminalStore';

const config = { id: 'id-1', label: 'api', dir: '/tmp', color: '#58a6ff' };

beforeEach(() => {
  useTerminalStore.setState({ terminals: [config], activeTerminalId: 'id-1', statuses: {} });
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('WorkspaceManager', () => {
  it('affiche les boutons Sauvegarder et Restaurer', () => {
    render(<WorkspaceManager />);
    expect(screen.getByTitle(/sauvegarder/i)).toBeInTheDocument();
    expect(screen.getByTitle(/restaurer/i)).toBeInTheDocument();
  });

  it('appelle invoke save_workspace avec les terminaux ouverts', async () => {
    render(<WorkspaceManager />);
    fireEvent.click(screen.getByTitle(/sauvegarder/i));
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('save_workspace', expect.objectContaining({
        workspace: expect.objectContaining({
          terminals: expect.arrayContaining([expect.objectContaining({ id: 'id-1' })]),
        }),
      }))
    );
  });

  it('appelle invoke load_workspace au clic Restaurer', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      name: 'ws', createdAt: '2026', terminals: [],
    });
    render(<WorkspaceManager />);
    fireEvent.click(screen.getByTitle(/restaurer/i));
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('load_workspace')
    );
  });
});
