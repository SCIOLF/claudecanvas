import '@testing-library/jest-dom';

// Mock ResizeObserver (not available in jsdom)
window.ResizeObserver = vi.fn(function ResizeObserver() {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
}) as unknown as typeof ResizeObserver;

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
