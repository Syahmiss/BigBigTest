//! Shell native JMC Operations Hub.
//!
//! UI kekal HTML/JS asal (folder `web/`), dibungkus dalam aplikasi. Rust di sini urus:
//! - plugin native: buka pautan luar (opener), dialog Simpan (dialog), tulis fail (fs)
//! - command kecil `app_info` untuk web tahu ia berjalan dalam app & versi berapa

use serde::Serialize;

#[derive(Serialize)]
struct AppInfo {
    name: String,
    version: String,
    platform: &'static str,
}

fn platform() -> &'static str {
    if cfg!(target_os = "android") {
        "android"
    } else if cfg!(target_os = "ios") {
        "ios"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

/// Dipanggil dari JS: `window.__TAURI__.core.invoke('app_info')`
#[tauri::command]
fn app_info(app: tauri::AppHandle) -> AppInfo {
    let pkg = app.package_info();
    AppInfo {
        name: pkg.name.clone(),
        version: pkg.version.to_string(),
        platform: platform(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("ralat semasa menjalankan aplikasi JM Operations");
}
