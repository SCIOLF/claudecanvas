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
        assert!(!json.contains("start_prompt"), "JSON ne doit pas contenir 'start_prompt' quand None. JSON: {json}");
    }

    #[test]
    fn test_camelcase_serialization() {
        // Vérifie que les clés JSON sont en camelCase (pas snake_case)
        let ws = sample_workspace();
        let json = serialize_workspace(&ws).unwrap();
        assert!(json.contains("startPrompt"), "Doit contenir 'startPrompt', got: {json}");
        assert!(json.contains("createdAt"), "Doit contenir 'createdAt', got: {json}");
        assert!(!json.contains("start_prompt"), "Ne doit pas contenir 'start_prompt'");
        assert!(!json.contains("created_at"), "Ne doit pas contenir 'created_at'");
    }
}
