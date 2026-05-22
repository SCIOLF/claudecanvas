import { invoke } from '@tauri-apps/api/core';
import { useTerminalStore } from '../store/terminalStore';
import type { WorkspaceConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function WorkspaceManager() {
  const terminals = useTerminalStore((s) => s.terminals);
  const addTerminal = useTerminalStore((s) => s.addTerminal);

  const handleSave = async () => {
    const workspace: WorkspaceConfig = {
      name: 'Mon workspace',
      createdAt: new Date().toISOString(),
      terminals,
    };
    try {
      await invoke('save_workspace', { workspace });
    } catch (e) {
      console.error('Erreur save_workspace:', e);
    }
  };

  const handleLoad = async () => {
    try {
      const workspace = await invoke<WorkspaceConfig>('load_workspace');
      for (const config of workspace.terminals) {
        const newId = uuidv4(); // Nouveau UUID pour éviter les collisions
        const newConfig = { ...config, id: newId };
        await invoke('spawn_terminal', {
          id: newId,
          label: newConfig.label,
          dir: newConfig.dir,
          startPrompt: newConfig.startPrompt ?? null,
        });
        addTerminal(newConfig);
      }
    } catch (e) {
      if (String(e) !== 'Aucun fichier sélectionné') {
        console.error('Erreur load_workspace:', e);
      }
    }
  };

  const btnStyle: React.CSSProperties = {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '10px',
    cursor: 'pointer',
    color: '#8b949e',
  };

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      <button style={btnStyle} onClick={handleSave} title="Sauvegarder le workspace">
        💾 Workspace
      </button>
      <button style={btnStyle} onClick={handleLoad} title="Restaurer un workspace">
        📂 Restaurer
      </button>
    </div>
  );
}
