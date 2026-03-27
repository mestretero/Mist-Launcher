mod commands;

use commands::scanner::db;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file if it exists (for RAWG_API_KEY etc.)
    let _ = dotenvy::dotenv();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data dir");
            let database = db::init_db(&app_data_dir)
                .expect("Failed to initialize database");
            app.manage(database);
            Ok(())
        })
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
            commands::scanner::scan::list_drives,
            commands::scanner::scan::scan_games,
            commands::scanner::metadata::fetch_metadata,
            commands::scanner::library::get_local_games,
            commands::scanner::library::add_manual_game,
            commands::scanner::library::add_scanned_games,
            commands::scanner::library::update_game,
            commands::scanner::library::delete_game,
            commands::scanner::library::get_scan_config,
            commands::scanner::library::update_scan_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
