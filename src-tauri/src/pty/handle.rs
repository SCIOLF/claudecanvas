use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

/// Trouve le chemin absolu de `claude` en cherchant dans les emplacements courants.
/// Retourne le chemin absolu si trouvé, sinon `"claude"` (fallback au PATH).
fn find_claude_binary() -> String {
    let home = std::env::var("HOME").unwrap_or_default();

    // Chemins candidats par ordre de priorité
    let candidates = [
        format!("{}/.local/bin/claude", home),
        "/usr/local/bin/claude".to_string(),
        "/usr/bin/claude".to_string(),
    ];

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return path.clone();
        }
    }

    // Tenter `which claude` comme dernier recours
    if let Ok(output) = std::process::Command::new("which").arg("claude").output() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return path;
        }
    }

    "claude".to_string()
}

/// Construit un PATH étendu incluant les répertoires nvm et ~/.local/bin.
fn build_extended_path(home: &str, current_path: &str) -> String {
    let mut extras = vec![
        format!("{}/.local/bin", home),
        "/usr/local/bin".to_string(),
    ];

    // Ajouter tous les bin/ des versions node installées via nvm
    let nvm_dir = format!("{}/.nvm/versions/node", home);
    if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
        let mut versions: Vec<String> = entries
            .flatten()
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .map(|e| format!("{}/bin", e.path().display()))
            .collect();
        versions.sort_by(|a, b| b.cmp(a)); // plus récent en premier
        extras.extend(versions);
    }

    let extra = extras.join(":");
    if current_path.is_empty() {
        extra
    } else {
        format!("{}:{}", extra, current_path)
    }
}

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

        let claude_bin = find_claude_binary();
        let mut cmd = CommandBuilder::new(&claude_bin);
        cmd.cwd(dir);

        // Étendre le PATH pour que claude puisse trouver node/npm (nvm, ~/.local/bin, etc.)
        let home = std::env::var("HOME").unwrap_or_default();
        let current_path = std::env::var("PATH").unwrap_or_default();
        let extended_path = build_extended_path(&home, &current_path);
        cmd.env("PATH", extended_path);

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

    #[test]
    fn test_spawn_echo_and_read_output() {
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
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 })
            .unwrap();

        let cmd = CommandBuilder::new("cat");
        let _child = pair.slave.spawn_command(cmd).unwrap();
        let mut writer = pair.master.take_writer().unwrap();

        let result = writer.write_all(b"test\n");
        assert!(result.is_ok());
    }
}
