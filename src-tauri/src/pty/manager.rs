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

    #[test]
    fn test_new_manager_is_empty() {
        let manager = PtyManager::new();
        assert!(manager.ids().is_empty());
        assert!(manager.write_input("any-id", "data").is_err());
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
}
