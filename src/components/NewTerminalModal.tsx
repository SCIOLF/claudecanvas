import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { useTerminalStore } from '../store/terminalStore';
import { getAccentColor } from '../types';

interface NewTerminalModalProps {
  onClose: () => void;
}

export function NewTerminalModal({ onClose }: NewTerminalModalProps) {
  const [dir, setDir] = useState('');
  const [label, setLabel] = useState('');
  const [startPrompt, setStartPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const { terminals, addTerminal } = useTerminalStore();

  const canCreate = dir.trim().length > 0 && label.trim().length > 0;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    const id = uuidv4();
    const color = getAccentColor(terminals.length);
    const config = {
      id,
      label: label.trim(),
      dir: dir.trim(),
      color,
      startPrompt: startPrompt.trim() || undefined,
    };

    try {
      await invoke('spawn_terminal', {
        id,
        label: config.label,
        dir: config.dir,
        startPrompt: config.startPrompt ?? null,
      });
      addTerminal(config);
      onClose();
    } catch (e) {
      console.error('Erreur spawn_terminal:', e);
    } finally {
      setLoading(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  };

  const modalStyle: React.CSSProperties = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '24px',
    width: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const inputStyle: React.CSSProperties = {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '4px',
    padding: '6px 10px',
    color: '#e0e0e0',
    fontSize: '12px',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '11px',
    color: '#8b949e',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: '#e0e0e0', fontSize: '14px', margin: 0 }}>Nouveau terminal Claude Code</h3>

        <label style={labelStyle} htmlFor="dir-input">
          Répertoire de travail *
          <input
            id="dir-input"
            style={inputStyle}
            placeholder="/home/user/mon-projet"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            aria-label="Répertoire de travail"
          />
        </label>

        <label style={labelStyle} htmlFor="label-input">
          Label *
          <input
            id="label-input"
            style={inputStyle}
            placeholder="mon-projet"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Label du terminal"
          />
        </label>

        <label style={labelStyle} htmlFor="prompt-input">
          Prompt initial (optionnel)
          <input
            id="prompt-input"
            style={inputStyle}
            placeholder="Analyse le codebase..."
            value={startPrompt}
            onChange={(e) => setStartPrompt(e.target.value)}
          />
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '12px' }}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            style={{ background: canCreate ? '#238636' : '#21262d', border: 'none', color: canCreate ? '#fff' : '#555', borderRadius: '4px', padding: '6px 16px', cursor: canCreate ? 'pointer' : 'not-allowed', fontSize: '12px' }}
            onClick={handleCreate}
            disabled={!canCreate || loading}
          >
            {loading ? '...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
