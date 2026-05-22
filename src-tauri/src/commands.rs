#[cfg(feature = "tauri-full")]
use std::sync::{Arc, Mutex};
#[cfg(feature = "tauri-full")]
use tauri::{AppHandle, Emitter, State};
#[cfg(feature = "tauri-full")]
use crate::pty::PtyManager;
#[cfg(feature = "tauri-full")]
use crate::workspace::{WorkspaceConfigRust, deserialize_workspace, serialize_workspace};

#[cfg(feature = "tauri-full")]
pub type PtyManagerState = Arc<Mutex<PtyManager>>;

#[cfg(feature = "tauri-full")]
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

#[cfg(feature = "tauri-full")]
#[tauri::command]
pub fn send_input(
    state: State<'_, PtyManagerState>,
    id: String,
    data: String,
) -> Result<(), String> {
    match state.lock().unwrap().write_input(&id, &data) {
        Ok(_) => Ok(()),
        Err(e) if e.contains("not found") => Ok(()),
        Err(e) => Err(e),
    }
}

#[cfg(feature = "tauri-full")]
#[tauri::command]
pub fn kill_terminal(
    state: State<'_, PtyManagerState>,
    id: String,
) -> Result<(), String> {
    state.lock().unwrap().kill(&id)
}

#[cfg(feature = "tauri-full")]
#[tauri::command]
pub async fn save_workspace(
    app: AppHandle,
    workspace: WorkspaceConfigRust,
) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;

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

#[cfg(feature = "tauri-full")]
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
