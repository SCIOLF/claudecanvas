import { describe, it, expect } from 'vitest';
import type { TerminalConfig, WorkspaceConfig, TerminalStatus } from '../types';
import { ACCENT_COLORS, getAccentColor } from '../types';

describe('types', () => {
  it('ACCENT_COLORS has 8 entries', () => {
    expect(ACCENT_COLORS).toHaveLength(8);
  });

  it('getAccentColor wraps cyclically', () => {
    expect(getAccentColor(0)).toBe(ACCENT_COLORS[0]);
    expect(getAccentColor(8)).toBe(ACCENT_COLORS[0]);
    expect(getAccentColor(9)).toBe(ACCENT_COLORS[1]);
  });

  it('TerminalConfig shape is valid', () => {
    const config: TerminalConfig = {
      id: 'abc',
      label: 'projet',
      dir: '/home/user',
      color: '#58a6ff',
    };
    expect(config.id).toBe('abc');
    expect(config.startPrompt).toBeUndefined();
  });
});
