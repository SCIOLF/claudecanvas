import { describe, it, expect, beforeEach } from 'vitest';
import { useTerminalStore } from '../store/terminalStore';

const makeConfig = (overrides = {}) => ({
  id: 'id-1',
  label: 'test',
  dir: '/tmp',
  color: '#58a6ff',
  ...overrides,
});

beforeEach(() => {
  useTerminalStore.setState({
    terminals: [],
    activeTerminalId: null,
    statuses: {},
  });
});

describe('terminalStore', () => {
  it('addTerminal inserts config and sets it active', () => {
    const store = useTerminalStore.getState();
    store.addTerminal(makeConfig());
    const s = useTerminalStore.getState();
    expect(s.terminals).toHaveLength(1);
    expect(s.activeTerminalId).toBe('id-1');
    expect(s.statuses['id-1']).toBe('active');
  });

  it('addTerminal does not change activeTerminalId if one already set', () => {
    const store = useTerminalStore.getState();
    store.addTerminal(makeConfig({ id: 'id-1' }));
    store.addTerminal(makeConfig({ id: 'id-2' }));
    expect(useTerminalStore.getState().activeTerminalId).toBe('id-1');
  });

  it('removeTerminal deletes config and status', () => {
    const store = useTerminalStore.getState();
    store.addTerminal(makeConfig());
    store.removeTerminal('id-1');
    const s = useTerminalStore.getState();
    expect(s.terminals).toHaveLength(0);
    expect(s.statuses['id-1']).toBeUndefined();
    expect(s.activeTerminalId).toBeNull();
  });

  it('removeTerminal sets next terminal active if removed was active', () => {
    const store = useTerminalStore.getState();
    store.addTerminal(makeConfig({ id: 'id-1' }));
    store.addTerminal(makeConfig({ id: 'id-2' }));
    store.removeTerminal('id-1');
    expect(useTerminalStore.getState().activeTerminalId).toBe('id-2');
  });

  it('setActiveTerminal updates activeTerminalId', () => {
    const store = useTerminalStore.getState();
    store.addTerminal(makeConfig({ id: 'id-1' }));
    store.addTerminal(makeConfig({ id: 'id-2' }));
    store.setActiveTerminal('id-2');
    expect(useTerminalStore.getState().activeTerminalId).toBe('id-2');
  });

  it('updateStatus changes terminal status', () => {
    const store = useTerminalStore.getState();
    store.addTerminal(makeConfig());
    store.updateStatus('id-1', 'waiting');
    expect(useTerminalStore.getState().statuses['id-1']).toBe('waiting');
  });
});
