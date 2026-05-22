#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod pty;
mod workspace;

#[cfg(feature = "tauri-full")]
use commands::PtyManagerState;
#[cfg(feature = "tauri-full")]
use pty::PtyManager;
#[cfg(feature = "tauri-full")]
use std::sync::{Arc, Mutex};

fn main() {
    #[cfg(feature = "tauri-full")]
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

    #[cfg(not(feature = "tauri-full"))]
    println!("ClaudeCanvas (no Tauri — test mode)");
}
