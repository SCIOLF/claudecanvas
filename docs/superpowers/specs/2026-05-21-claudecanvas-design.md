# ClaudeCanvas — Design Spec

**Date :** 2026-05-21  
**Statut :** Approuvé  
**Stack :** Tauri · React · TypeScript · Rust

---

## 1. Objectif

ClaudeCanvas est une application de bureau qui permet de démarrer et contrôler plusieurs instances Claude Code depuis une interface unifiée. Au lieu de jongler entre de nombreux terminaux, l'utilisateur dispose d'une vue d'ensemble avec une sidebar de miniatures live et un panneau principal focalisé.

---

## 2. Architecture

### 2.1 Vue d'ensemble des couches

```
┌─────────────────────────────────────────────────┐
│  FRONTEND — React + TypeScript                  │
│  App · Sidebar · MainPanel · WorkspaceManager   │
│  NewTerminalModal                               │
│  State : Zustand                                │
│  Terminal rendering : xterm.js + FitAddon       │
└────────────────┬────────────────────────────────┘
                 │ Tauri IPC (Commands + Events)
┌────────────────┴────────────────────────────────┐
│  BACKEND — Rust (Tauri)                         │
│  PtyManager · PtyHandle · EventEmitter          │
│  WorkspaceStore (serde_json)                    │
│  Crate PTY : portable-pty                       │
└────────────────┬────────────────────────────────┘
                 │ PTY (pseudo-terminal)
┌────────────────┴────────────────────────────────┐
│  SYSTÈME                                        │
│  N processus `claude` indépendants              │
│  Chacun dans son PTY + répertoire de travail    │
└─────────────────────────────────────────────────┘
```

### 2.2 Communication Tauri IPC

**Commandes (front → back) :**

| Commande | Paramètres | Description |
|---|---|---|
| `spawn_terminal` | `{id, label, dir, start_prompt?}` | Crée un PTY et lance `claude` |
| `send_input` | `{id, data}` | Envoie des données au stdin du PTY |
| `kill_terminal` | `{id}` | Termine le processus et libère le PTY |
| `save_workspace` | `{workspace: WorkspaceConfig}` | Sauvegarde un fichier JSON via dialog OS |
| `load_workspace` | — | Ouvre un fichier JSON via dialog OS |

**Events (back → front) :**

| Event | Payload | Description |
|---|---|---|
| `terminal:output:{id}` | `{data: string}` | Chunk de sortie du processus |
| `terminal:status:{id}` | `{status: TerminalStatus}` | Changement de statut détecté |

---

## 3. Composants Frontend

### 3.1 `App`
- Composant racine
- Initialise le store Zustand (`useTerminalStore`)
- Orchestre le layout global : `Sidebar` à gauche, `MainPanel` à droite (pas de routing multi-vues — tout est dans un seul layout)

### 3.2 `Sidebar`
- Liste scrollable de `TerminalCard`
- Bouton `+ Nouveau terminal` en bas (ouvre `NewTerminalModal`)
- Largeur fixe : 140px

### 3.3 `TerminalCard`
- Affiche le label du terminal avec sa couleur d'accent (auto-assignée à la création depuis une palette fixe de 8 couleurs, cyclique)
- Badge de statut : `● actif` (vert) · `● attend` (orange) · `● erreur` (rouge) · `● terminé` (gris)
- Miniature xterm.js live : instance xterm.js dédiée avec police réduite (6px) et dimensions fixes — pas de `transform: scale()` (approche évitée car rendu flou et capture d'events problématique)
- Bordure colorée sur la carte active
- Clic → change le terminal actif dans le store

### 3.4 `MainPanel`
- Header : label, chemin du répertoire, badge statut, boutons `⟳ Relancer` et `✕ Fermer`
- Zone xterm.js pleine taille avec `FitAddon` (s'adapte au redimensionnement de la fenêtre)
- Barre bas : toggle `⌨ Terminal` / `👁 Lecture seule`, champ de saisie libre, bouton Envoyer

### 3.5 `NewTerminalModal`
- Champs : répertoire de travail (avec picker natif), label, prompt initial (optionnel)
- Validation : répertoire obligatoire, label obligatoire
- À la confirmation : `invoke("spawn_terminal", ...)` — si `start_prompt` est renseigné, il est envoyé automatiquement via `invoke("send_input", {id, data: startPrompt + "\n"})` dès que le PTY est prêt (après réception du premier `terminal:output:{id}`)

### 3.6 `WorkspaceManager`
- Bouton `💾 Sauvegarder` : snapshot de la config de tous les terminaux ouverts → `invoke("save_workspace")`
- Bouton `📂 Restaurer` : `invoke("load_workspace")` → re-spawn de chaque terminal avec sa config sauvegardée. De nouveaux UUIDs sont générés à la restauration (les IDs sauvegardés ne sont pas réutilisés) pour éviter les collisions avec des terminaux déjà ouverts.

---

## 4. Backend Rust

### 4.1 `PtyManager`
- `HashMap<String, PtyHandle>` — clé = UUID du terminal
- Méthodes : `spawn(id, dir, label)`, `write(id, data)`, `kill(id)`
- Partagé entre les commandes Tauri via `Arc<Mutex<PtyManager>>`

### 4.2 `PtyHandle`
- Encapsule un PTY `portable-pty` + le processus `claude`
- Spawn du processus : `claude` (ou `claude --dangerously-skip-permissions` selon config)
- Thread de lecture dédié : lit `pty.stdout` en boucle, émet `terminal:output:{id}` par chunk
- Détection de statut dans le thread de lecture :
  - Pattern `?` en fin de ligne → émet `status: "waiting"`
  - Exit code 0 → émet `status: "done"`
  - Exit code ≠ 0 → émet `status: "error"`
  - Sinon → émet `status: "active"`

### 4.3 `WorkspaceStore`
- Sérialisation/désérialisation via `serde_json`
- Sauvegarde via dialog fichier natif Tauri (`tauri-plugin-dialog`)
- Format : voir section 5

---

## 5. Modèles de données

### `TerminalConfig`
```json
{
  "id": "uuid-v4",
  "label": "projet-api",
  "dir": "/home/user/projects/api",
  "start_prompt": "Analyse le codebase et liste les endpoints"
}
```

### `WorkspaceConfig`
```json
{
  "name": "Mon workspace",
  "created_at": "2026-05-21T10:00:00Z",
  "terminals": [TerminalConfig, ...]
}
```

### `TerminalStatus`
```typescript
type TerminalStatus = "active" | "waiting" | "done" | "error";
```

---

## 6. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Processus `claude` quitte normalement (exit 0) | Badge → gris "terminé", bouton `⟳ Relancer` actif |
| Processus `claude` crashe (exit ≠ 0) | Badge rouge "erreur", miniature affiche la dernière ligne |
| Répertoire introuvable au spawn | Toast d'erreur UI, terminal non créé |
| Restauration workspace — répertoire manquant | Avertissement par terminal concerné, les autres se lancent |
| Échec PTY (Rust) | Event `terminal:status` avec `{status: "error", message}` |
| `send_input` sur terminal terminé | Commande ignorée silencieusement côté Rust |

---

## 7. Stratégie de tests

### Tests Rust (backend)
- `PtyManager::spawn` : vérifie que le processus est créé et que le PTY répond
- `PtyManager::write` + lecture : round-trip stdin/stdout
- `PtyManager::kill` : vérifie que le processus se termine et que le thread de lecture s'arrête
- Détection de statut : tests unitaires sur la logique de parsing des patterns

### Tests React (frontend)
- Framework : **Vitest** + **Testing Library**
- `TerminalCard` : rendu correct selon le statut (couleurs, badges)
- `NewTerminalModal` : validation des champs, appel invoke au submit
- `WorkspaceManager` : appels invoke save/load
- Store Zustand : transitions de statut

### Tests E2E
- Framework : **Playwright** via `tauri-driver`
- Scénario nominal : créer un terminal → voir l'output → changer de terminal → sauvegarder workspace → fermer → restaurer workspace

---

## 8. Structure du projet

```
claudefigmaterminal/
├── src/                        # Frontend React
│   ├── components/
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   └── TerminalCard.tsx
│   │   ├── MainPanel/
│   │   │   ├── MainPanel.tsx
│   │   │   └── TerminalHeader.tsx
│   │   ├── NewTerminalModal.tsx
│   │   └── WorkspaceManager.tsx
│   ├── store/
│   │   └── terminalStore.ts    # Zustand store
│   ├── hooks/
│   │   └── useTerminal.ts      # Abonnement events Tauri + xterm.js
│   ├── types/
│   │   └── index.ts            # TerminalConfig, WorkspaceConfig, TerminalStatus
│   └── App.tsx
├── src-tauri/                  # Backend Rust
│   ├── src/
│   │   ├── pty/
│   │   │   ├── manager.rs      # PtyManager
│   │   │   └── handle.rs       # PtyHandle + thread de lecture
│   │   ├── workspace.rs        # WorkspaceStore
│   │   ├── commands.rs         # Commandes Tauri exposées
│   │   └── main.rs
│   └── Cargo.toml
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-21-claudecanvas-design.md
└── .gitignore
```

---

## 9. Dépendances clés

### Frontend
| Package | Rôle |
|---|---|
| `@tauri-apps/api` | IPC Tauri (invoke, listen) |
| `xterm` | Émulateur de terminal |
| `xterm-addon-fit` | Adaptation à la taille du conteneur |
| `zustand` | State management |
| `react` + `typescript` | UI |

### Backend (Rust)
| Crate | Rôle |
|---|---|
| `portable-pty` | Pseudo-terminal cross-platform |
| `tauri` | Framework desktop |
| `tauri-plugin-dialog` | Dialog fichier natif |
| `serde` + `serde_json` | Sérialisation workspace |
| `uuid` | Génération d'IDs de terminaux |
| `tokio` | Runtime async pour les threads de lecture |
