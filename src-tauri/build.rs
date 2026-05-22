#[cfg(feature = "tauri-full")]
fn main() {
    tauri_build::build()
}

#[cfg(not(feature = "tauri-full"))]
fn main() {}
