import { useState } from 'react';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainPanel } from './components/MainPanel/MainPanel';
import { NewTerminalModal } from './components/NewTerminalModal';
import { WorkspaceManager } from './components/WorkspaceManager';

export default function App() {
  const [showModal, setShowModal] = useState(false);

  const titlebarStyle: React.CSSProperties = {
    background: '#161b22',
    borderBottom: '1px solid #21262d',
    padding: '6px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    height: '38px',
    minHeight: '38px',
  };

  const appStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  };

  const bodyStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  return (
    <div style={appStyle}>
      <header style={titlebarStyle}>
        <span style={{ color: '#58a6ff', fontWeight: 'bold', fontSize: '13px' }}>
          ⬡ ClaudeCanvas
        </span>
        <button
          style={{ background: '#21262d', border: '1px solid #30363d', color: '#7ee787', borderRadius: '4px', padding: '3px 10px', fontSize: '10px', cursor: 'pointer', marginLeft: '8px' }}
          onClick={() => setShowModal(true)}
        >
          ＋ Nouveau terminal
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <WorkspaceManager />
        </div>
      </header>

      <div style={bodyStyle}>
        <Sidebar onNewTerminal={() => setShowModal(true)} />
        <MainPanel />
      </div>

      {showModal && <NewTerminalModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
