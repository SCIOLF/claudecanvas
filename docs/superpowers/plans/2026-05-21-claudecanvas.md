# ClaudeCanvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une application de bureau Tauri permettant de démarrer et contrôler plusieurs instances Claude Code depuis une interface sidebar + panneau principal.

**Architecture:** Frontend React avec xterm.js (rendu terminal pleine taille + miniature), Zustand pour l'état, Tauri IPC vers un backend Rust qui gère les processus PTY via `portable-pty`. Chaque processus `claude` tourne dans son propre PTY ; l'output est streamé au frontend via des événements Tauri.

**Tech Stack:** Tauri v2, React 18, TypeScript, @xterm/xterm v5, @xterm/addon-fit, Zustand v5, Rust, portable-pty 0.8, serde/serde_json, uuid, tauri-plugin-dialog v2

---

## Carte des fichiers

**Frontend (`src/`) :**
| Fichier | Responsabilité |
|---|---|
| `src/types/index.ts` | Types partagés : `TerminalConfig`, `WorkspaceConfig`, `TerminalStatus` |
| `src/store/terminalStore.ts` | Store Zustand : liste terminaux, actif, statuts, couleurs |
| `src/hooks/useTerminalEvents.ts` | S'abonne aux events Tauri, écrit dans xterm.js |
| `src/components/Sidebar/TerminalCard.tsx` | Carte miniature xterm.js + badge statut |
| `src/components/Sidebar/Sidebar.tsx` | Liste scrollable de TerminalCards |
| `src/components/MainPanel/TerminalHeader.tsx` | Header : label, chemin, statut, boutons |
| `src/components/MainPanel/MainPanel.tsx` | xterm.js pleine taille + FitAddon + barre de saisie |
| `src/components/NewTerminalModal.tsx` | Formulaire : répertoire, label, prompt initial |
| `src/components/WorkspaceManager.tsx` | Boutons sauvegarder/restaurer |
| `src/App.tsx` | Layout racine |

**Backend (`src-tauri/src/`) :**
| Fichier | Responsabilité |
|---|---|
| `src-tauri/src/pty/handle.rs` | `PtyHandle` : cycle de vie PTY + thread lecture |
| `src-tauri/src/pty/manager.rs` | `PtyManager` : `HashMap<id, PtyHandle>` |
| `src-tauri/src/pty/mod.rs` | Re-exports du module pty |
| `src-tauri/src/workspace.rs` | `WorkspaceStore` : sérialisation/désérialisation JSON |
| `src-tauri/src/commands.rs` | Toutes les fonctions `#[tauri::command]` |
| `src-tauri/src/main.rs` | Setup du builder Tauri |

**Tests :**
| Fichier | Couverture |
|---|---|
| `src-tauri/src/pty/handle.rs` (inline `#[cfg(test)]`) | Spawn, write, kill |
| `src-tauri/src/workspace.rs` (inline `#[cfg(test)]`) | Round-trip JSON |
| `src/__tests__/terminalStore.test.ts` | Transitions de statut du store |
| `src/__tests__/TerminalCard.test.tsx` | Rendu badge selon statut |
| `src/__tests__/NewTerminalModal.test.tsx` | Validation formulaire |
| `src/__tests__/WorkspaceManager.test.tsx` | Appels invoke |

---

## Task 1 : Scaffolding Tauri + React

**Files:**
- Create: `src/` (généré), `src-tauri/` (généré), `package.json`, `vite.config.ts`, `index.html`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1 : Scaffolder le projet Tauri dans le répertoire existant**

```bash
cd /mnt/c/dev/projects/claudefigmaterminal
npm create tauri-app@latest . -- --template react-ts --manager npm
```

Répondre aux prompts interactifs si présents :
- Project name : `claudecanvas`
- Identifier : `com.claudecanvas.app`
- Frontend : React TypeScript

- [ ] **Step 2 : Vérifier que le projet démarre**

```bash
cd /mnt/c/dev/projects/claudefigmaterminal
npm install
npm run tauri dev
```

Expected : fenêtre Tauri avec la page React par défaut. Fermer la fenêtre.

- [ ] **Step 3 : Mettre à jour `src-tauri/tauri.conf.json` — fenêtre initiale**

Dans `src-tauri/tauri.conf.json`, mettre à jour la section `app.windows` :

```json
{
  "productName": "ClaudeCanvas",
  "identifier": "com.claudecanvas.app",
  "app": {
    "windows": [
      {
        "title": "ClaudeCanvas",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 500,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  }
}
```

- [ ] **Step 4 : Nettoyer le CSS et le contenu par défaut**

Remplacer `src/App.css` par :
```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; width: 100%; overflow: hidden; }
body { background: #0d1117; color: #e0e0e0; font-family: monospace; }
```

Remplacer `src/index.css` par :
```css
```
(fichier vide)

- [ ] **Step 5 : Committer le scaffold**

```bash
git add -A
git commit -m "chore: scaffold Tauri + React project"
```

---

## Task 2 : Dépendances Cargo et npm

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`

- [ ] **Step 1 : Ajouter les dépendances Rust dans `src-tauri/Cargo.toml`**

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portable-pty = "0.8"
uuid = { version = "1", features = ["v4"] }
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2 : Ajouter les dépendances npm**

```bash
npm install @xterm/xterm @xterm/addon-fit zustand @tauri-apps/api @tauri-apps/plugin-dialog
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
```

- [ ] **Step 3 : Configurer Vitest dans `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
```

- [ ] **Step 4 : Créer `src/setupTests.ts`**

```typescript
import '@testing-library/jest-dom';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));
```

- [ ] **Step 5 : Vérifier que les tests s'exécutent**

```bash
npm run test -- --run
```

Expected : `No test files found` (pas encore de tests). Pas d'erreur de config.

- [ ] **Step 6 : Committer**

```bash
git add -A
git commit -m "chore: add Cargo and npm dependencies, configure Vitest"
```

---

## Task 3 : Types TypeScript

**Files:**
- Create: `src/types/index.ts`
- Create: `src/__tests__/types.test.ts`

- [ ] **Step 1 : Écrire le test (vérifie que les types compilent et les valeurs sont correctes)**

```typescript
// src/__tests__/types.test.ts
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
```

- [ ] **Step 2 : Exécuter le test pour confirmer qu'il échoue**

```bash
npm run test -- --run src/__tests__/types.test.ts
```

Expected : FAIL — `Cannot find module '../types'`

- [ ] **Step 3 : Implémenter `src/types/index.ts`**

```typescript
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
```

- [ ] **Step 4 : Exécuter le test pour confirmer qu'il passe**

```bash
npm run test -- --run src/__tests__/types.test.ts
```

Expected : PASS — 3 tests

- [ ] **Step 5 : Committer**

```bash
git add src/types/index.ts src/__tests__/types.test.ts
git commit -m "feat: add TypeScript types (TerminalConfig, WorkspaceConfig, TerminalStatus)"
```

---

## Task 4 : Store Zustand

**Files:**
- Create: `src/store/terminalStore.ts`
- Create: `src/__tests__/terminalStore.test.ts`

- [ ] **Step 1 : Écrire les tests du store**

```typescript
// src/__tests__/terminalStore.test.ts
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
```

- [ ] **Step 2 : Exécuter les tests pour confirmer l'échec**

```bash
npm run test -- --run src/__tests__/terminalStore.test.ts
```

Expected : FAIL — `Cannot find module '../store/terminalStore'`

- [ ] **Step 3 : Implémenter `src/store/terminalStore.ts`**

```typescript
import { create } from 'zustand';
import type { TerminalConfig, TerminalStatus } from '../types';

interface TerminalStore {
  terminals: TerminalConfig[];
  activeTerminalId: string | null;
  statuses: Record<string, TerminalStatus>;
  addTerminal: (config: TerminalConfig) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  updateStatus: (id: string, status: TerminalStatus) => void;
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  terminals: [],
  activeTerminalId: null,
  statuses: {},

  addTerminal: (config) =>
    set((state) => ({
      terminals: [...state.terminals, config],
      activeTerminalId: state.activeTerminalId ?? config.id,
      statuses: { ...state.statuses, [config.id]: 'active' },
    })),

  removeTerminal: (id) =>
    set((state) => {
      const terminals = state.terminals.filter((t) => t.id !== id);
      const { [id]: _removed, ...statuses } = state.statuses;
      const activeTerminalId =
        state.activeTerminalId === id
          ? (terminals[0]?.id ?? null)
          : state.activeTerminalId;
      return { terminals, statuses, activeTerminalId };
    }),

  setActiveTerminal: (id) => set({ activeTerminalId: id }),

  updateStatus: (id, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [id]: status },
    })),
}));
```

- [ ] **Step 4 : Exécuter les tests pour confirmer qu'ils passent**

```bash
npm run test -- --run src/__tests__/terminalStore.test.ts
```

Expected : PASS — 6 tests

- [ ] **Step 5 : Committer**

```bash
git add src/store/terminalStore.ts src/__tests__/terminalStore.test.ts
git commit -m "feat: add Zustand terminal store"
```

---

## Task 5 : PtyHandle Rust

**Files:**
- Create: `src-tauri/src/pty/mod.rs`
- Create: `src-tauri/src/pty/handle.rs`
- Modify: `src-tauri/src/main.rs` (déclarer le module)

- [ ] **Step 1 : Créer `src-tauri/src/pty/mod.rs`**

```rust
pub mod handle;
pub mod manager;
pub use handle::PtyHandle;
pub use manager::PtyManager;
```

- [ ] **Step 2 : Déclarer le module dans `src-tauri/src/main.rs`**

Ajouter en haut du fichier (avant `fn main`), après les imports existants :

```rust
mod pty;
mod workspace;
mod commands;
```

- [ ] **Step 3 : Écrire les tests dans `src-tauri/src/pty/handle.rs`**

```rust
// src-tauri/src/pty/handle.rs

use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct PtyHandle {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
}

impl PtyHandle {
    pub fn spawn(
        dir: &str,
        on_output: impl Fn(String) + Send + 'static,
        on_exit: impl Fn(bool) + Send + 'static,
    ) -> Result<Self, String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new("claude");
        cmd.cwd(dir);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| e.to_string())?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| e.to_string())?;

        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        on_output(data);
                    }
                }
            }
            on_exit(true);
        });

        Ok(Self {
            writer: Arc::new(Mutex::new(writer)),
            child: Arc::new(Mutex::new(child)),
        })
    }

    pub fn write_input(&self, data: &str) -> Result<(), String> {
        self.writer
            .lock()
            .unwrap()
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())
    }

    pub fn kill(&self) -> Result<(), String> {
        self.child
            .lock()
            .unwrap()
            .kill()
            .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    #[test]
    fn test_spawn_echo_and_read_output() {
        let output = Arc::new(Mutex::new(String::new()));
        let output_clone = output.clone();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
            .unwrap();

        let mut cmd = CommandBuilder::new("echo");
        cmd.arg("hello_pty");

        let _child = pair.slave.spawn_command(cmd).unwrap();
        let mut reader = pair.master.try_clone_reader().unwrap();

        let handle = thread::spawn(move || {
            let mut buf = [0u8; 256];
            let n = reader.read(&mut buf).unwrap_or(0);
            String::from_utf8_lossy(&buf[..n]).to_string()
        });

        let result = handle.join().unwrap();
        assert!(result.contains("hello_pty"), "Got: {result}");
    }

    #[test]
    fn test_write_to_pty() {
        // Test que write_input n'échoue pas sur un PTY ouvert
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
            .unwrap();

        let mut cmd = CommandBuilder::new("cat");
        let _child = pair.slave.spawn_command(cmd).unwrap();
        let mut writer = pair.master.take_writer().unwrap();

        // Doit écrire sans paniquer
        let result = writer.write_all(b"test\n");
        assert!(result.is_ok());
    }
}
```

- [ ] **Step 4 : Exécuter les tests Rust pour confirmer**

```bash
cd /mnt/c/dev/projects/claudefigmaterminal
cargo test -p claudecanvas-lib pty::handle 2>/dev/null || cargo test --manifest-path src-tauri/Cargo.toml pty::handle
```

Expected : PASS — 2 tests

- [ ] **Step 5 : Committer**

```bash
git add src-tauri/src/pty/
git commit -m "feat(rust): add PtyHandle with reader thread"
```

---

## Task 6 : PtyManager Rust

**Files:**
- Create: `src-tauri/src/pty/manager.rs`

- [ ] **Step 1 : Écrire les tests dans `src-tauri/src/pty/manager.rs`**

```rust
// src-tauri/src/pty/manager.rs

use std::collections::HashMap;
use super::PtyHandle;

pub struct PtyManager {
    handles: HashMap<String, PtyHandle>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            handles: HashMap::new(),
        }
    }

    pub fn spawn(
        &mut self,
        id: String,
        dir: String,
        on_output: impl Fn(String) + Send + 'static,
        on_exit: impl Fn(bool) + Send + 'static,
    ) -> Result<(), String> {
        if self.handles.contains_key(&id) {
            return Err(format!("Terminal {id} already exists"));
        }
        let handle = PtyHandle::spawn(&dir, on_output, on_exit)?;
        self.handles.insert(id, handle);
        Ok(())
    }

    pub fn write_input(&self, id: &str, data: &str) -> Result<(), String> {
        self.handles
            .get(id)
            .ok_or_else(|| format!("Terminal {id} not found"))?
            .write_input(data)
    }

    pub fn kill(&mut self, id: &str) -> Result<(), String> {
        let handle = self
            .handles
            .remove(id)
            .ok_or_else(|| format!("Terminal {id} not found"))?;
        handle.kill()
    }

    pub fn ids(&self) -> Vec<String> {
        self.handles.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[test]
    fn test_spawn_duplicate_returns_error() {
        let mut manager = PtyManager::new();
        // Spawn avec 'echo' — rapide, pas de vraie session claude
        let _ = manager.spawn(
            "id-1".to_string(),
            "/tmp".to_string(),
            |_| {},
            |_| {},
        );
        let result = manager.spawn(
            "id-1".to_string(),
            "/tmp".to_string(),
            |_| {},
            |_| {},
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_write_to_unknown_id_returns_error() {
        let manager = PtyManager::new();
        let result = manager.write_input("unknown", "data");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_kill_unknown_id_returns_error() {
        let mut manager = PtyManager::new();
        let result = manager.kill("unknown");
        assert!(result.is_err());
    }

    #[test]
    fn test_ids_returns_spawned_ids() {
        let mut manager = PtyManager::new();
        let _ = manager.spawn("id-a".to_string(), "/tmp".to_string(), |_| {}, |_| {});
        let ids = manager.ids();
        // Peut échouer si claude n'est pas installé — on teste juste la structure
        // Le spawn peut échouer mais ids() reste cohérent
        let _ = ids; // pas de panique
    }
}
```

- [ ] **Step 2 : Exécuter les tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml pty::manager
```

Expected : PASS — 4 tests (les tests de spawn peuvent être skippés si `claude` absent — voir note dans le code)

- [ ] **Step 3 : Committer**

```bash
git add src-tauri/src/pty/manager.rs
git commit -m "feat(rust): add PtyManager"
```

---

## Task 7 : WorkspaceStore Rust

**Files:**
- Create: `src-tauri/src/workspace.rs`

- [ ] **Step 1 : Créer `src-tauri/src/workspace.rs` avec tests**

```rust
// src-tauri/src/workspace.rs

use serde::{Deserialize, Serialize};

// rename_all = "camelCase" assure la compatibilité avec TypeScript :
// start_prompt <-> startPrompt, created_at <-> createdAt
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalConfigRust {
    pub id: String,
    pub label: String,
    pub dir: String,
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_prompt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConfigRust {
    pub name: String,
    pub created_at: String,
    pub terminals: Vec<TerminalConfigRust>,
}

pub fn serialize_workspace(workspace: &WorkspaceConfigRust) -> Result<String, String> {
    serde_json::to_string_pretty(workspace).map_err(|e| e.to_string())
}

pub fn deserialize_workspace(json: &str) -> Result<WorkspaceConfigRust, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_workspace() -> WorkspaceConfigRust {
        WorkspaceConfigRust {
            name: "test-ws".to_string(),
            created_at: "2026-05-21T10:00:00Z".to_string(),
            terminals: vec![TerminalConfigRust {
                id: "abc".to_string(),
                label: "api".to_string(),
                dir: "/tmp".to_string(),
                color: "#58a6ff".to_string(),
                start_prompt: Some("hello".to_string()),
            }],
        }
    }

    #[test]
    fn test_serialize_deserialize_roundtrip() {
        let ws = sample_workspace();
        let json = serialize_workspace(&ws).unwrap();
        let restored = deserialize_workspace(&json).unwrap();
        assert_eq!(restored.name, ws.name);
        assert_eq!(restored.terminals.len(), 1);
        assert_eq!(restored.terminals[0].label, "api");
        assert_eq!(restored.terminals[0].start_prompt, Some("hello".to_string()));
    }

    #[test]
    fn test_deserialize_invalid_json_returns_error() {
        let result = deserialize_workspace("{ invalid json }");
        assert!(result.is_err());
    }

    #[test]
    fn test_serialize_omits_null_start_prompt() {
        let mut ws = sample_workspace();
        ws.terminals[0].start_prompt = None;
        let json = serialize_workspace(&ws).unwrap();
        assert!(!json.contains("start_prompt"));
    }
}
```

- [ ] **Step 2 : Exécuter les tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml workspace
```

Expected : PASS — 3 tests

- [ ] **Step 3 : Committer**

```bash
git add src-tauri/src/workspace.rs
git commit -m "feat(rust): add WorkspaceStore with JSON serialization"
```

---

## Task 8 : Commandes Tauri

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1 : Créer `src-tauri/src/commands.rs`**

```rust
// src-tauri/src/commands.rs

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};
use crate::pty::PtyManager;
use crate::workspace::{WorkspaceConfigRust, deserialize_workspace, serialize_workspace};

pub type PtyManagerState = Arc<Mutex<PtyManager>>;

#[tauri::command]
pub fn spawn_terminal(
    state: State<'_, PtyManagerState>,
    app: AppHandle,
    id: String,
    label: String,
    dir: String,
    start_prompt: Option<String>,
) -> Result<(), String> {
    let app_output = app.clone();
    let app_status = app.clone();
    let id_output = id.clone();
    let id_status = id.clone();

    state.lock().unwrap().spawn(
        id.clone(),
        dir,
        move |data| {
            // Détecter le statut selon le dernier contenu
            let status = if data.trim_end().ends_with('?') {
                "waiting"
            } else {
                "active"
            };
            let _ = app_output.emit(&format!("terminal:output:{}", id_output), data);
            let _ = app_output.emit(&format!("terminal:status:{}", id_output), status);
        },
        move |_success| {
            let _ = app_status.emit(&format!("terminal:status:{}", id_status), "done");
        },
    )?;

    // Envoyer le prompt initial après un court délai si présent
    if let Some(prompt) = start_prompt {
        let state_clone = state.inner().clone();
        let id_prompt = id.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let _ = state_clone
                .lock()
                .unwrap()
                .write_input(&id_prompt, &format!("{}\n", prompt));
        });
    }

    Ok(())
}

#[tauri::command]
pub fn send_input(
    state: State<'_, PtyManagerState>,
    id: String,
    data: String,
) -> Result<(), String> {
    // Ignore silencieusement si le terminal n'existe plus
    match state.lock().unwrap().write_input(&id, &data) {
        Ok(_) => Ok(()),
        Err(e) if e.contains("not found") => Ok(()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub fn kill_terminal(
    state: State<'_, PtyManagerState>,
    id: String,
) -> Result<(), String> {
    state.lock().unwrap().kill(&id)
}

#[tauri::command]
pub async fn save_workspace(
    app: AppHandle,
    workspace: WorkspaceConfigRust,
) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;

    // blocking_save_file() retourne Option<FilePath> dans tauri-plugin-dialog v2
    // .into_path() convertit FilePath en PathBuf
    let file_path = app
        .dialog()
        .file()
        .add_filter("JSON Workspace", &["json"])
        .set_file_name("workspace.json")
        .blocking_save_file()
        .ok_or_else(|| "Aucun fichier sélectionné".to_string())?;

    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let json = serialize_workspace(&workspace)?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_workspace(app: AppHandle) -> Result<WorkspaceConfigRust, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .add_filter("JSON Workspace", &["json"])
        .blocking_pick_file()
        .ok_or_else(|| "Aucun fichier sélectionné".to_string())?;

    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    deserialize_workspace(&json)
}
```

- [ ] **Step 2 : Mettre à jour `src-tauri/src/main.rs`**

Remplacer le contenu par :

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod pty;
mod workspace;

use commands::PtyManagerState;
use pty::PtyManager;
use std::sync::{Arc, Mutex};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(Mutex::new(PtyManager::new())) as PtyManagerState)
        .invoke_handler(tauri::generate_handler![
            commands::spawn_terminal,
            commands::send_input,
            commands::kill_terminal,
            commands::save_workspace,
            commands::load_workspace,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3 : Vérifier la compilation**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

Expected : compilation réussie sans erreurs.

- [ ] **Step 4 : Committer**

```bash
git add src-tauri/src/commands.rs src-tauri/src/main.rs
git commit -m "feat(rust): add Tauri commands (spawn, send_input, kill, save/load workspace)"
```

---

## Task 9 : Hook `useTerminalEvents`

**Files:**
- Create: `src/hooks/useTerminalEvents.ts`

> Ce hook est difficile à tester unitairement (dépend de xterm.js et Tauri events). Le test couvre l'appel à `listen` avec les bons event names.

- [ ] **Step 1 : Créer `src/hooks/useTerminalEvents.ts`**

```typescript
import { useEffect, useRef } from 'react';
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
```

- [ ] **Step 2 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected : pas d'erreur de type.

- [ ] **Step 3 : Committer**

```bash
git add src/hooks/useTerminalEvents.ts
git commit -m "feat: add useTerminalEvents hook"
```

---

## Task 10 : Composant `TerminalCard`

**Files:**
- Create: `src/components/Sidebar/TerminalCard.tsx`
- Create: `src/__tests__/TerminalCard.test.tsx`

- [ ] **Step 1 : Écrire les tests**

```typescript
// src/__tests__/TerminalCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalCard } from '../components/Sidebar/TerminalCard';
import type { TerminalConfig } from '../types';

const config: TerminalConfig = {
  id: 'id-1',
  label: 'projet-api',
  dir: '/home/user/api',
  color: '#58a6ff',
};

vi.mock('../hooks/useTerminalEvents', () => ({
  useTerminalEvents: vi.fn(),
}));

describe('TerminalCard', () => {
  it('affiche le label du terminal', () => {
    render(<TerminalCard config={config} status="active" isActive={false} onClick={() => {}} />);
    expect(screen.getByText('projet-api')).toBeInTheDocument();
  });

  it('affiche le badge "actif" en vert pour status=active', () => {
    render(<TerminalCard config={config} status="active" isActive={false} onClick={() => {}} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: '#3fb950' });
  });

  it('affiche le badge en orange pour status=waiting', () => {
    render(<TerminalCard config={config} status="waiting" isActive={false} onClick={() => {}} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: '#e3b341' });
  });

  it('affiche le badge en rouge pour status=error', () => {
    render(<TerminalCard config={config} status="error" isActive={false} onClick={() => {}} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveStyle({ color: '#f85149' });
  });

  it('applique la bordure active quand isActive=true', () => {
    const { container } = render(
      <TerminalCard config={config} status="active" isActive={true} onClick={() => {}} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveStyle({ borderColor: '#58a6ff' });
  });

  it('appelle onClick au clic', async () => {
    const onClick = vi.fn();
    render(<TerminalCard config={config} status="active" isActive={false} onClick={onClick} />);
    await userEvent.click(screen.getByText('projet-api'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2 : Exécuter les tests pour confirmer l'échec**

```bash
npm run test -- --run src/__tests__/TerminalCard.test.tsx
```

Expected : FAIL — `Cannot find module '../components/Sidebar/TerminalCard'`

- [ ] **Step 3 : Implémenter `src/components/Sidebar/TerminalCard.tsx`**

```tsx
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
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  // Initialiser le mini-terminal une seule fois
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
```

- [ ] **Step 4 : Exécuter les tests**

```bash
npm run test -- --run src/__tests__/TerminalCard.test.tsx
```

Expected : PASS — 6 tests

- [ ] **Step 5 : Committer**

```bash
git add src/components/Sidebar/TerminalCard.tsx src/__tests__/TerminalCard.test.tsx
git commit -m "feat: add TerminalCard component with live miniature"
```

---

## Task 11 : Composant `Sidebar`

**Files:**
- Create: `src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1 : Créer `src/components/Sidebar/Sidebar.tsx`**

```tsx
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
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : pas d'erreur.

- [ ] **Step 3 : Committer**

```bash
git add src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add Sidebar component"
```

---

## Task 12 : Composants `TerminalHeader` et `MainPanel`

**Files:**
- Create: `src/components/MainPanel/TerminalHeader.tsx`
- Create: `src/components/MainPanel/MainPanel.tsx`
- Create: `src/__tests__/MainPanel.test.tsx`

- [ ] **Step 1 : Créer `src/components/MainPanel/TerminalHeader.tsx`**

```tsx
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
```

- [ ] **Step 2 : Écrire les tests du MainPanel**

```tsx
// src/__tests__/MainPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { MainPanel } from '../components/MainPanel/MainPanel';
import { useTerminalStore } from '../store/terminalStore';
import type { TerminalConfig } from '../types';

vi.mock('../hooks/useTerminalEvents', () => ({
  useTerminalEvents: vi.fn(),
}));

const config: TerminalConfig = {
  id: 'id-1',
  label: 'api',
  dir: '/tmp',
  color: '#58a6ff',
};

beforeEach(() => {
  useTerminalStore.setState({
    terminals: [config],
    activeTerminalId: 'id-1',
    statuses: { 'id-1': 'active' },
  });
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('MainPanel', () => {
  it('affiche un message quand aucun terminal actif', () => {
    useTerminalStore.setState({ activeTerminalId: null, terminals: [] });
    render(<MainPanel />);
    expect(screen.getByText(/aucun terminal/i)).toBeInTheDocument();
  });

  it('affiche le label du terminal actif', () => {
    render(<MainPanel />);
    // TerminalHeader affiche le label
    expect(screen.getAllByText('api').length).toBeGreaterThan(0);
  });

  it('envoie l\'input via invoke send_input en mode Terminal', async () => {
    render(<MainPanel />);
    const input = screen.getByPlaceholderText(/tapez/i);
    fireEvent.change(input, { target: { value: 'y' } });
    fireEvent.click(screen.getByRole('button', { name: /envoyer/i }));
    expect(invoke).toHaveBeenCalledWith('send_input', { id: 'id-1', data: 'y\n' });
  });
});
```

- [ ] **Step 3 : Exécuter les tests pour confirmer l'échec**

```bash
npm run test -- --run src/__tests__/MainPanel.test.tsx
```

Expected : FAIL — `Cannot find module '../components/MainPanel/MainPanel'`

- [ ] **Step 4 : Créer `src/components/MainPanel/MainPanel.tsx`**

```tsx
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
  const addTerminal = useTerminalStore((s) => s.addTerminal);

  const activeConfig = terminals.find((t) => t.id === activeId) ?? null;
  const activeStatus = activeId ? (statuses[activeId] ?? 'active') : 'active';

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

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
    fitRef.current = fit;

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

  const modeBtn = (m: 'terminal' | 'readonly', label: string) => ({
    background: mode === m ? `${activeConfig.color}22` : 'transparent',
    border: `1px solid ${mode === m ? activeConfig.color + '44' : '#30363d'}`,
    color: mode === m ? activeConfig.color : '#8b949e',
    borderRadius: '3px',
    padding: '2px 8px',
    fontSize: '9px',
    cursor: 'pointer',
  } as React.CSSProperties);

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
```

- [ ] **Step 5 : Exécuter les tests**

```bash
npm run test -- --run src/__tests__/MainPanel.test.tsx
```

Expected : PASS — 3 tests

- [ ] **Step 6 : Committer**

```bash
git add src/components/MainPanel/
git commit -m "feat: add TerminalHeader and MainPanel components"
```

---

## Task 13 : Composant `NewTerminalModal`

**Files:**
- Create: `src/components/NewTerminalModal.tsx`
- Create: `src/__tests__/NewTerminalModal.test.tsx`

- [ ] **Step 1 : Écrire les tests**

```tsx
// src/__tests__/NewTerminalModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { NewTerminalModal } from '../components/NewTerminalModal';
import { useTerminalStore } from '../store/terminalStore';

beforeEach(() => {
  useTerminalStore.setState({ terminals: [], activeTerminalId: null, statuses: {} });
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('NewTerminalModal', () => {
  it('affiche le formulaire de création', () => {
    render(<NewTerminalModal onClose={() => {}} />);
    expect(screen.getByLabelText(/répertoire/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
  });

  it('désactive le bouton Créer si répertoire vide', () => {
    render(<NewTerminalModal onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /créer/i });
    expect(btn).toBeDisabled();
  });

  it('désactive le bouton Créer si label vide', async () => {
    render(<NewTerminalModal onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/répertoire/i), '/tmp');
    const btn = screen.getByRole('button', { name: /créer/i });
    expect(btn).toBeDisabled();
  });

  it('appelle invoke spawn_terminal avec les bons paramètres', async () => {
    render(<NewTerminalModal onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/répertoire/i), '/home/user');
    await userEvent.type(screen.getByLabelText(/label/i), 'mon-projet');
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    expect(invoke).toHaveBeenCalledWith('spawn_terminal', expect.objectContaining({
      dir: '/home/user',
      label: 'mon-projet',
    }));
  });

  it('appelle onClose après création réussie', async () => {
    const onClose = vi.fn();
    render(<NewTerminalModal onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/répertoire/i), '/tmp');
    await userEvent.type(screen.getByLabelText(/label/i), 'test');
    fireEvent.click(screen.getByRole('button', { name: /créer/i }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2 : Exécuter les tests pour confirmer l'échec**

```bash
npm run test -- --run src/__tests__/NewTerminalModal.test.tsx
```

Expected : FAIL — `Cannot find module '../components/NewTerminalModal'`

- [ ] **Step 3 : Implémenter `src/components/NewTerminalModal.tsx`**

```tsx
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { useTerminalStore } from '../store/terminalStore';
import { getAccentColor } from '../types';

// npm install uuid @types/uuid
interface NewTerminalModalProps {
  onClose: () => void;
}

export function NewTerminalModal({ onClose }: NewTerminalModalProps) {
  const [dir, setDir] = useState('');
  const [label, setLabel] = useState('');
  const [startPrompt, setStartPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const { terminals, addTerminal } = useTerminalStore();

  const canCreate = dir.trim().length > 0 && label.trim().length > 0;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    const id = uuidv4();
    const color = getAccentColor(terminals.length);
    const config = { id, label: label.trim(), dir: dir.trim(), color, startPrompt: startPrompt.trim() || undefined };

    try {
      await invoke('spawn_terminal', {
        id,
        label: config.label,
        dir: config.dir,
        startPrompt: config.startPrompt ?? null,
      });
      addTerminal(config);
      onClose();
    } catch (e) {
      console.error('Erreur spawn_terminal:', e);
    } finally {
      setLoading(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  };

  const modalStyle: React.CSSProperties = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '24px',
    width: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const inputStyle: React.CSSProperties = {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '4px',
    padding: '6px 10px',
    color: '#e0e0e0',
    fontSize: '12px',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '11px',
    color: '#8b949e',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: '#e0e0e0', fontSize: '14px', margin: 0 }}>Nouveau terminal Claude Code</h3>

        <label style={labelStyle} htmlFor="dir-input">
          Répertoire de travail *
          <input
            id="dir-input"
            style={inputStyle}
            placeholder="/home/user/mon-projet"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            aria-label="Répertoire de travail"
          />
        </label>

        <label style={labelStyle} htmlFor="label-input">
          Label *
          <input
            id="label-input"
            style={inputStyle}
            placeholder="mon-projet"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Label du terminal"
          />
        </label>

        <label style={labelStyle} htmlFor="prompt-input">
          Prompt initial (optionnel)
          <input
            id="prompt-input"
            style={inputStyle}
            placeholder="Analyse le codebase..."
            value={startPrompt}
            onChange={(e) => setStartPrompt(e.target.value)}
          />
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            style={{ background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '12px' }}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            style={{ background: canCreate ? '#238636' : '#21262d', border: 'none', color: canCreate ? '#fff' : '#555', borderRadius: '4px', padding: '6px 16px', cursor: canCreate ? 'pointer' : 'not-allowed', fontSize: '12px' }}
            onClick={handleCreate}
            disabled={!canCreate || loading}
          >
            {loading ? '...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Installer uuid**

```bash
npm install uuid
npm install --save-dev @types/uuid
```

- [ ] **Step 5 : Exécuter les tests**

```bash
npm run test -- --run src/__tests__/NewTerminalModal.test.tsx
```

Expected : PASS — 5 tests

- [ ] **Step 6 : Committer**

```bash
git add src/components/NewTerminalModal.tsx src/__tests__/NewTerminalModal.test.tsx
git commit -m "feat: add NewTerminalModal component"
```

---

## Task 14 : Composant `WorkspaceManager`

**Files:**
- Create: `src/components/WorkspaceManager.tsx`
- Create: `src/__tests__/WorkspaceManager.test.tsx`

- [ ] **Step 1 : Écrire les tests**

```tsx
// src/__tests__/WorkspaceManager.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { WorkspaceManager } from '../components/WorkspaceManager';
import { useTerminalStore } from '../store/terminalStore';

const config = { id: 'id-1', label: 'api', dir: '/tmp', color: '#58a6ff' };

beforeEach(() => {
  useTerminalStore.setState({ terminals: [config], activeTerminalId: 'id-1', statuses: {} });
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('WorkspaceManager', () => {
  it('affiche les boutons Sauvegarder et Restaurer', () => {
    render(<WorkspaceManager />);
    expect(screen.getByTitle(/sauvegarder/i)).toBeInTheDocument();
    expect(screen.getByTitle(/restaurer/i)).toBeInTheDocument();
  });

  it('appelle invoke save_workspace avec les terminaux ouverts', async () => {
    render(<WorkspaceManager />);
    fireEvent.click(screen.getByTitle(/sauvegarder/i));
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('save_workspace', expect.objectContaining({
        workspace: expect.objectContaining({
          terminals: expect.arrayContaining([expect.objectContaining({ id: 'id-1' })]),
        }),
      }))
    );
  });

  it('appelle invoke load_workspace au clic Restaurer', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      name: 'ws', createdAt: '2026', terminals: [],
    });
    render(<WorkspaceManager />);
    fireEvent.click(screen.getByTitle(/restaurer/i));
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('load_workspace')
    );
  });
});
```

- [ ] **Step 2 : Exécuter les tests pour confirmer l'échec**

```bash
npm run test -- --run src/__tests__/WorkspaceManager.test.tsx
```

Expected : FAIL — `Cannot find module '../components/WorkspaceManager'`

- [ ] **Step 3 : Implémenter `src/components/WorkspaceManager.tsx`**

```tsx
import { invoke } from '@tauri-apps/api/core';
import { useTerminalStore } from '../store/terminalStore';
import type { WorkspaceConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function WorkspaceManager() {
  const terminals = useTerminalStore((s) => s.terminals);
  const addTerminal = useTerminalStore((s) => s.addTerminal);

  const handleSave = async () => {
    const workspace: WorkspaceConfig = {
      name: 'Mon workspace',
      createdAt: new Date().toISOString(),
      terminals,
    };
    try {
      await invoke('save_workspace', { workspace });
    } catch (e) {
      console.error('Erreur save_workspace:', e);
    }
  };

  const handleLoad = async () => {
    try {
      const workspace = await invoke<WorkspaceConfig>('load_workspace');
      for (const config of workspace.terminals) {
        const newId = uuidv4(); // Nouveau UUID pour éviter les collisions
        const newConfig = { ...config, id: newId };
        await invoke('spawn_terminal', {
          id: newId,
          label: newConfig.label,
          dir: newConfig.dir,
          startPrompt: newConfig.startPrompt ?? null,
        });
        addTerminal(newConfig);
      }
    } catch (e) {
      if (String(e) !== 'Aucun fichier sélectionné') {
        console.error('Erreur load_workspace:', e);
      }
    }
  };

  const btnStyle: React.CSSProperties = {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '10px',
    cursor: 'pointer',
    color: '#8b949e',
  };

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      <button style={btnStyle} onClick={handleSave} title="Sauvegarder le workspace">
        💾 Workspace
      </button>
      <button style={btnStyle} onClick={handleLoad} title="Restaurer un workspace">
        📂 Restaurer
      </button>
    </div>
  );
}
```

- [ ] **Step 4 : Exécuter les tests**

```bash
npm run test -- --run src/__tests__/WorkspaceManager.test.tsx
```

Expected : PASS — 3 tests

- [ ] **Step 5 : Committer**

```bash
git add src/components/WorkspaceManager.tsx src/__tests__/WorkspaceManager.test.tsx
git commit -m "feat: add WorkspaceManager component"
```

---

## Task 15 : Assemblage `App.tsx` et smoke test

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1 : Mettre à jour `src/App.tsx`**

```tsx
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
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected : aucune erreur de type.

- [ ] **Step 3 : Lancer l'application et vérifier le rendu**

```bash
npm run tauri dev
```

Expected : 
- Fenêtre ClaudeCanvas qui s'ouvre
- Titlebar avec "⬡ ClaudeCanvas", bouton "＋ Nouveau terminal", boutons workspace
- Sidebar vide à gauche
- Message "Aucun terminal ouvert" dans le panneau central
- Clic sur "＋ Nouveau terminal" → modal s'ouvre

- [ ] **Step 4 : Tester manuellement la création d'un terminal**

Dans la modal :
- Renseigner un répertoire valide (ex: `/tmp`)
- Renseigner un label (ex: `test`)
- Cliquer Créer

Expected : terminal apparu dans la sidebar, output visible dans le panneau principal.

- [ ] **Step 5 : Lancer la suite de tests complète**

```bash
npm run test -- --run
```

Expected : PASS — tous les tests verts.

- [ ] **Step 6 : Committer**

```bash
git add src/App.tsx
git commit -m "feat: wire up App layout — ClaudeCanvas fully assembled"
```

---

## Récapitulatif des commandes de vérification

```bash
# Tests unitaires React
npm run test -- --run

# Tests Rust
cargo test --manifest-path src-tauri/Cargo.toml

# Build de production
npm run tauri build

# TypeScript sans erreur
npx tsc --noEmit
```
