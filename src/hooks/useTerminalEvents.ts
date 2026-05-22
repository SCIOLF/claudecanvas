import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Terminal } from '@xterm/xterm';
import type { TerminalStatus } from '../types';
import { useTerminalStore } from '../store/terminalStore';

/**
 * Abonne une instance xterm.js aux events Tauri output + status pour un terminal donné.
 * À appeler dans chaque composant qui rend un terminal (MainPanel + TerminalCard).
 */
export function useTerminalEvents(
  id: string,
  terminalRef: React.RefObject<Terminal | null>,
) {
  const updateStatus = useTerminalStore((s) => s.updateStatus);

  useEffect(() => {
    if (!id) return;

    let unlistenOutput: (() => void) | null = null;
    let unlistenStatus: (() => void) | null = null;

    listen<string>(`terminal:output:${id}`, (event) => {
      terminalRef.current?.write(event.payload);
    }).then((fn) => {
      unlistenOutput = fn;
    });

    listen<TerminalStatus>(`terminal:status:${id}`, (event) => {
      updateStatus(id, event.payload);
    }).then((fn) => {
      unlistenStatus = fn;
    });

    return () => {
      unlistenOutput?.();
      unlistenStatus?.();
    };
  }, [id]);
}
