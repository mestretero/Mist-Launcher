mod commands;
mod tunnel;

use commands::scanner::db;
use tauri::Manager;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file if it exists (for RAWG_API_KEY etc.)
    let _ = dotenvy::dotenv();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // ─── Database ────────────────────────────────────────────
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data dir");
            let database = db::init_db(&app_data_dir)
                .expect("Failed to initialize database");
            app.manage(database);

            // ─── System Tray ─────────────────────────────────────────
            let show = MenuItemBuilder::with_id("show", "Show MIST").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

            let tray_icon = app.default_window_icon()
                .cloned()
                .expect("Window icon not found — check icons/ directory");

            TrayIconBuilder::new()
                .icon(tray_icon)
                .tooltip("MIST")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        // ─── Close → hide to tray ───────────────────────────────────
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
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
            commands::scanner::library::clear_metadata_cache,
            commands::scanner::library::add_local_game_to_collection,
            commands::scanner::library::remove_local_game_from_collection,
            commands::scanner::library::get_local_collection_games,
            commands::scanner::library::get_collections_for_local_game,
            commands::scanner::library::get_scan_config,
            commands::scanner::library::update_scan_config,
            commands::scanner::library::list_exe_files,
            commands::tunnel::generate_keypair,
            commands::tunnel::create_tunnel,
            commands::tunnel::destroy_tunnel,
            commands::tunnel::get_tunnel_status,
            commands::tunnel::get_tunnel_listen_port,
            commands::server_manager::start_dedicated_server,
            commands::server_manager::stop_dedicated_server,
            commands::server_manager::find_server_binary,
            commands::achievements::start_achievement_watcher,
        ])
        .run(tauri::generate_context!())
        .expect("MIST uygulaması başlatılamadı");
}
