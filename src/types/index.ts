export type TerminalStatus = 'active' | 'waiting' | 'done' | 'error';

export interface TerminalConfig {
  id: string;
  label: string;
  dir: string;
  color: string;
  startPrompt?: string;
}

export interface WorkspaceConfig {
  name: string;
  createdAt: string;
  terminals: TerminalConfig[];
}

export const ACCENT_COLORS = [
  '#58a6ff',
  '#3fb950',
  '#f0883e',
  '#bc8cff',
  '#e3b341',
  '#79c0ff',
  '#ff7b72',
  '#56d364',
] as const;

export function getAccentColor(index: number): string {
  return ACCENT_COLORS[index % ACCENT_COLORS.length];
}
