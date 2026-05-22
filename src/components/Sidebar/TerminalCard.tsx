import { useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import type { TerminalConfig, TerminalStatus } from '../../types';
import { useTerminalEvents } from '../../hooks/useTerminalEvents';
import '@xterm/xterm/css/xterm.css';

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

interface TerminalCardProps {
  config: TerminalConfig;
  status: TerminalStatus;
  isActive: boolean;
  onClick: () => void;
}

export function TerminalCard({ config, status, isActive, onClick }: TerminalCardProps) {
  const termRef = useRef<Terminal | null>(null);

  // Initialiser le mini-terminal une seule fois quand l'élément DOM est disponible
  const initMiniTerminal = (el: HTMLDivElement | null) => {
    if (!el || termRef.current) return;
    const term = new Terminal({
      fontSize: 6,
      rows: 8,
      cols: 20,
      disableStdin: true,
      theme: { background: '#0d1117', foreground: '#e0e0e0' },
      scrollback: 50,
    });
    term.open(el);
    termRef.current = term;
  };

  useTerminalEvents(config.id, termRef);

  const cardStyle: React.CSSProperties = {
    background: '#0d1117',
    border: `1px solid ${isActive ? config.color : '#21262d'}`,
    borderRadius: '6px',
    overflow: 'hidden',
    cursor: 'pointer',
    marginBottom: '6px',
  };

  const headerStyle: React.CSSProperties = {
    padding: '3px 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: isActive ? `${config.color}11` : 'transparent',
  };

  return (
    <div style={cardStyle} onClick={onClick}>
      <div style={headerStyle}>
        <span style={{ color: config.color, fontSize: '9px', fontWeight: 'bold' }}>
          {config.label}
        </span>
        <span
          data-testid="status-badge"
          style={{ color: STATUS_COLORS[status], fontSize: '8px' }}
        >
          ● {STATUS_LABELS[status]}
        </span>
      </div>
      <div
        ref={initMiniTerminal}
        style={{ height: '52px', overflow: 'hidden', padding: '2px' }}
      />
    </div>
  );
}
