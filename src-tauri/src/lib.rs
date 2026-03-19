mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::download::download_game,
            commands::download::pause_download,
            commands::download::resume_download,
            commands::download::cancel_download,
            commands::launcher::launch_game,
            commands::launcher::stop_game,
            commands::files::get_disk_space,
            commands::files::verify_game_files,
            commands::files::uninstall_game,
            commands::auth::store_token,
            commands::auth::get_token,
            commands::auth::delete_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
