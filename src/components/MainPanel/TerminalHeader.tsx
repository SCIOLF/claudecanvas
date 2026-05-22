import { invoke } from '@tauri-apps/api/core';
import type { TerminalConfig, TerminalStatus } from '../../types';
import { useTerminalStore } from '../../store/terminalStore';

const STATUS_COLORS: Record<TerminalStatus, string> = {
  active: '#3fb950',
  waiting: '#e3b341',
  done: '#8b949e',
  error: '#f85149',
};

const STATUS_LABELS: Record<TerminalStatus, string> = {
  active: 'actif',
  waiting: 'attend',
  done: 'terminé',
  error: 'erreur',
};

interface TerminalHeaderProps {
  config: TerminalConfig;
  status: TerminalStatus;
  onRestart: () => void;
}

export function TerminalHeader({ config, status, onRestart }: TerminalHeaderProps) {
  const removeTerminal = useTerminalStore((s) => s.removeTerminal);

  const handleClose = async () => {
    try {
      await invoke('kill_terminal', { id: config.id });
    } catch {
      // Ignorer si déjà terminé
    }
    removeTerminal(config.id);
  };

  const headerStyle: React.CSSProperties = {
    background: '#161b22',
    padding: '5px 12px',
    borderBottom: '1px solid #21262d',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
  };

  const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid #30363d',
    borderRadius: '3px',
    padding: '2px 8px',
    fontSize: '9px',
    cursor: 'pointer',
  };

  return (
    <div style={headerStyle}>
      <span style={{ color: config.color }}>📁</span>
      <span style={{ color: config.color, fontWeight: 'bold' }}>{config.label}</span>
      <span style={{ color: '#8b949e' }}>{config.dir}</span>
      <span style={{ color: STATUS_COLORS[status] }}>● {STATUS_LABELS[status]}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
        <button style={{ ...btnStyle, color: '#8b949e' }} onClick={onRestart}>
          ⟳ Relancer
        </button>
        <button style={{ ...btnStyle, color: '#f85149' }} onClick={handleClose}>
          ✕ Fermer
        </button>
      </div>
    </div>
  );
}
