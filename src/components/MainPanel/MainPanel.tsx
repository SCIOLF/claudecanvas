import { useRef, useState, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { useTerminalStore } from '../../store/terminalStore';
import { useTerminalEvents } from '../../hooks/useTerminalEvents';
import { TerminalHeader } from './TerminalHeader';
import '@xterm/xterm/css/xterm.css';

export function MainPanel() {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeId = useTerminalStore((s) => s.activeTerminalId);
  const statuses = useTerminalStore((s) => s.statuses);

  const activeConfig = terminals.find((t) => t.id === activeId) ?? null;
  const activeStatus = activeId ? (statuses[activeId] ?? 'active') : 'active';

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<'terminal' | 'readonly'>('terminal');

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      fontSize: 13,
      theme: { background: '#0d1117', foreground: '#e0e0e0' },
      scrollback: 1000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;

    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, [activeId]);

  useTerminalEvents(activeId ?? '', termRef);

  const handleSend = async () => {
    if (!activeId || !inputValue.trim()) return;
    await invoke('send_input', { id: activeId, data: inputValue + '\n' });
    setInputValue('');
  };

  const handleRestart = async () => {
    if (!activeConfig) return;
    try {
      await invoke('kill_terminal', { id: activeConfig.id });
    } catch {}
    await invoke('spawn_terminal', {
      id: activeConfig.id,
      label: activeConfig.label,
      dir: activeConfig.dir,
      startPrompt: activeConfig.startPrompt,
    });
  };

  if (!activeConfig) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        Aucun terminal ouvert — cliquez sur ＋ pour commencer
      </div>
    );
  }

  const inputBarStyle: React.CSSProperties = {
    background: '#161b22',
    borderTop: '1px solid #21262d',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const modeBtn = (m: 'terminal' | 'readonly', _label: string): React.CSSProperties => ({
    background: mode === m ? `${activeConfig.color}22` : 'transparent',
    border: `1px solid ${mode === m ? activeConfig.color + '44' : '#30363d'}`,
    color: mode === m ? activeConfig.color : '#8b949e',
    borderRadius: '3px',
    padding: '2px 8px',
    fontSize: '9px',
    cursor: 'pointer',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TerminalHeader config={activeConfig} status={activeStatus} onRestart={handleRestart} />

      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', background: '#0d1117' }} />

      <div style={inputBarStyle}>
        <span style={{ color: '#555', fontSize: '10px' }}>MODE</span>
        <button style={modeBtn('terminal', '⌨')} onClick={() => setMode('terminal')}>⌨ Terminal</button>
        <button style={modeBtn('readonly', '👁')} onClick={() => setMode('readonly')}>👁 Lecture seule</button>
        <input
          style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 8px', color: '#e0e0e0', fontSize: '11px' }}
          placeholder="Tapez un message ou une commande..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={mode === 'readonly'}
        />
        <button
          style={{ background: '#238636', border: 'none', color: '#fff', borderRadius: '4px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer' }}
          onClick={handleSend}
          disabled={mode === 'readonly'}
        >
          Envoyer ↵
        </button>
      </div>
    </div>
  );
}
