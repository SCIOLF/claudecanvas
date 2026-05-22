import { useTerminalStore } from '../../store/terminalStore';
import { TerminalCard } from './TerminalCard';

interface SidebarProps {
  onNewTerminal: () => void;
}

export function Sidebar({ onNewTerminal }: SidebarProps) {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeTerminalId = useTerminalStore((s) => s.activeTerminalId);
  const statuses = useTerminalStore((s) => s.statuses);
  const setActiveTerminal = useTerminalStore((s) => s.setActiveTerminal);

  const sidebarStyle: React.CSSProperties = {
    width: '150px',
    minWidth: '150px',
    background: '#161b22',
    borderRight: '1px solid #21262d',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  };

  const addButtonStyle: React.CSSProperties = {
    border: '1px dashed #30363d',
    borderRadius: '6px',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#444',
    marginTop: 'auto',
    fontSize: '18px',
    background: 'transparent',
  };

  return (
    <aside style={sidebarStyle}>
      <div style={{ color: '#8b949e', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Terminaux ({terminals.length})
      </div>

      {terminals.map((config) => (
        <TerminalCard
          key={config.id}
          config={config}
          status={statuses[config.id] ?? 'active'}
          isActive={config.id === activeTerminalId}
          onClick={() => setActiveTerminal(config.id)}
        />
      ))}

      <button style={addButtonStyle} onClick={onNewTerminal} title="Nouveau terminal">
        ＋
      </button>
    </aside>
  );
}
