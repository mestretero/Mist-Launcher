use super::models::{ScannedGame, ScanProgress};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

const LAUNCHER_PATTERNS: &[(&str, &str)] = &[
    ("steam", "steamapps"),
    ("epic", "Epic Games"),
    ("ubisoft", "Ubisoft Game Launcher"),
    ("gog", "GOG Galaxy"),
    ("ea", "Origin Games"),
    ("ea", "EA Games"),
];

const STRIP_SUFFIXES: &[&str] = &[
    "Launcher", "Setup", "Installer", "Uninstall",
    "x64", "x86", "Win64", "Win32", "DX11", "DX12",
    "Shipping", "Binaries", "Bin",
];

/// Exe filenames that are never games
const BLOCKED_EXE_NAMES: &[&str] = &[
    "uninstall", "unins000", "unins001", "uninst", "setup", "install",
    "update", "updater", "autoupdate", "crashreporter", "crashhandler",
    "vc_redist", "vcredist", "dxsetup", "dxwebsetup", "dotnetfx",
    "uwp_helper", "helper", "service", "server", "daemon",
    "python", "pythonw", "node", "npm", "npx", "pip",
    "git", "bash", "sh", "cmd", "powershell",
    "java", "javaw", "javaws",
    "winrar", "unrar", "rar", "7z", "7zfm", "7zg",
    "notepad++", "code", "devenv",
    "chrome", "firefox", "msedge", "opera", "brave",
    "filezilla", "putty", "winscp",
    "vlc", "audacity", "obs64", "obs32",
    "awk", "sed", "grep", "curl", "wget",
    "mailtodisk", "mercury", "apache", "httpd", "nginx", "mysql", "mysqld",
    "php", "php-cgi", "perl", "ruby",
    "steam", "steamservice", "steamerrorreporter",
    "epicgameslauncher", "unrealcefsubprocess",
    "ubisoftconnect", "ubisoftgamelauncher",
    "galaxyclient", "galaxycommunication",
    "creative cloud", "adobedesktopservice",
];

/// Directory path segments that indicate non-game software
const BLOCKED_PATH_SEGMENTS: &[&str] = &[
    "xampp", "wamp", "mamp", "laragon",
    "nodejs", "node_modules", "npm", "nvm",
    "python", "anaconda", "miniconda", "pip",
    "ruby", "perl", "php",
    "java", "jdk", "jre", "gradle", "maven",
    "git", ".git", "mingw", "msys",
    "visual studio", "vs code", "vscode", "jetbrains",
    "adobe", "creative cloud",
    "windows kits", "windows sdk", "windowsapps",
    "microsoft office", "microsoft visual",
    "common files", "windows nt", "internet explorer",
    "windows defender", "windows mail", "windows media",
    "windowspowershell", "system32", "syswow64",
    "filezilla", "putty", "winscp", "teraterm",
    "7-zip", "winrar",
    "vlc", "audacity", "obs-studio",
    "docker", "virtualbox", "vmware",
    "nvidia", "amd", "intel", "realtek",
    "cmake", "rust", "cargo", ".rustup", ".cargo",
    "tortoisegit", "tortoisesvn",
    "postgresql", "mysql", "mongodb", "redis",
    "mercurymail", "mailtodisk",
    "libreoffice", "openoffice",
    "dotnet", "framework", "sdk",
];

/// Check if an exe filename looks like a non-game executable
fn is_blocked_exe(exe_path: &Path) -> bool {
    let file_name = exe_path.file_stem()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // Check blocked exe names
    for blocked in BLOCKED_EXE_NAMES {
        if file_name == *blocked || file_name.starts_with(&format!("{}-", blocked)) {
            return true;
        }
    }

    // Check blocked path segments
    let full_path = exe_path.to_string_lossy().to_lowercase();
    for segment in BLOCKED_PATH_SEGMENTS {
        if full_path.contains(&format!("\\{}", segment)) || full_path.contains(&format!("/{}", segment)) {
            return true;
        }
    }

    false
}

pub fn exe_to_title(exe_name: &str) -> String {
    let name = exe_name.trim_end_matches(".exe").trim_end_matches(".EXE");
    let mut result = String::new();
    let mut prev_lower = false;
    for ch in name.chars() {
        if ch == '_' || ch == '-' || ch == '.' {
            result.push(' ');
            prev_lower = false;
        } else if ch.is_uppercase() && prev_lower {
            result.push(' ');
            result.push(ch);
            prev_lower = false;
        } else if ch.is_ascii_digit() && prev_lower {
            result.push(' ');
            result.push(ch);
            prev_lower = false;
        } else {
            result.push(ch);
            prev_lower = ch.is_lowercase();
        }
    }
    let mut title = result.trim().to_string();
    for suffix in STRIP_SUFFIXES {
        if title.ends_with(suffix) {
            title = title[..title.len() - suffix.len()].trim().to_string();
        }
    }
    title
}

fn detect_launcher(path: &Path) -> Option<String> {
    let path_str = path.to_string_lossy().to_lowercase();
    for (launcher, pattern) in LAUNCHER_PATTERNS {
        if path_str.contains(&pattern.to_lowercase()) {
            return Some(launcher.to_string());
        }
    }
    None
}

/// Known non-game publisher names in registry
const BLOCKED_PUBLISHERS: &[&str] = &[
    "microsoft", "adobe", "google", "mozilla", "oracle", "intel",
    "nvidia", "amd", "realtek", "logitech", "corsair",
    "python", "node.js", "rust", "java", "apache",
    "xampp", "filezilla", "7-zip", "winrar", "rarlab",
    "videolan", "audacity", "obs", "gimp",
    "docker", "vmware", "virtualbox",
    "postgresql", "mysql", "mongodb",
    "jetbrains", "sublime", "notepad++", "github",
    "libreoffice", "openoffice",
];

#[cfg(target_os = "windows")]
fn scan_registry() -> Vec<(String, PathBuf)> {
    let mut results = Vec::new();
    let keys = [
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];
    for (hive, path) in keys {
        if let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(path, KEY_READ) {
            for name in key.enum_keys().filter_map(|k| k.ok()) {
                if let Ok(subkey) = key.open_subkey_with_flags(&name, KEY_READ) {
                    let display_name: Result<String, _> = subkey.get_value("DisplayName");
                    let install_loc: Result<String, _> = subkey.get_value("InstallLocation");
                    if let (Ok(name), Ok(loc)) = (display_name, install_loc) {
                        if loc.is_empty() { continue; }

                        // Filter by publisher — skip known non-game publishers
                        let publisher: Result<String, _> = subkey.get_value("Publisher");
                        if let Ok(pub_name) = &publisher {
                            let pub_lower = pub_name.to_lowercase();
                            if BLOCKED_PUBLISHERS.iter().any(|bp| pub_lower.contains(bp)) {
                                continue;
                            }
                        }

                        // Skip if install path is in a blocked directory
                        let loc_path = PathBuf::from(&loc);
                        if is_blocked_exe(&loc_path) {
                            continue;
                        }

                        results.push((name, loc_path));
                    }
                }
            }
        }
    }
    results
}

#[cfg(not(target_os = "windows"))]
fn scan_registry() -> Vec<(String, PathBuf)> {
    Vec::new()
}

fn scan_directory(dir: &Path, max_depth: usize) -> Vec<PathBuf> {
    WalkDir::new(dir)
        .max_depth(max_depth)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension()
                .map(|ext| ext.eq_ignore_ascii_case("exe"))
                .unwrap_or(false)
        })
        .map(|e| e.path().to_path_buf())
        .collect()
}

#[tauri::command]
pub async fn scan_games(
    app: AppHandle,
    paths: Vec<String>,
    exclude_launchers: Vec<String>,
) -> Result<Vec<ScannedGame>, String> {
    let exclude_set: HashSet<String> = exclude_launchers.into_iter()
        .map(|l| l.to_lowercase())
        .collect();

    let mut all_games: Vec<ScannedGame> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    let registry_entries = scan_registry();
    for (name, install_path) in &registry_entries {
        let launcher = detect_launcher(install_path);
        if let Some(ref l) = launcher {
            if exclude_set.contains(l) { continue; }
        }
        let exes = scan_directory(install_path, 2);
        for exe in exes {
            if is_blocked_exe(&exe) { continue; }
            let exe_str = exe.to_string_lossy().to_string();
            if seen_paths.contains(&exe_str.to_lowercase()) { continue; }
            seen_paths.insert(exe_str.to_lowercase());
            all_games.push(ScannedGame {
                exe_path: exe_str,
                suggested_title: name.clone(),
                install_path: install_path.to_string_lossy().to_string(),
                detected_launcher: launcher.clone(),
            });
        }
    }

    let _ = app.emit("scan-progress", ScanProgress {
        scanned_dirs: 1,
        total_dirs: paths.len() as u32 + 1,
        found_games: all_games.len() as u32,
    });

    for (i, path_str) in paths.iter().enumerate() {
        let dir = Path::new(path_str);
        if !dir.exists() || !dir.is_dir() { continue; }
        let exes = scan_directory(dir, 4);
        for exe in exes {
            if is_blocked_exe(&exe) { continue; }
            let exe_str = exe.to_string_lossy().to_string();
            if seen_paths.contains(&exe_str.to_lowercase()) { continue; }
            let launcher = detect_launcher(&exe);
            if let Some(ref l) = launcher {
                if exclude_set.contains(l) { continue; }
            }
            let file_name = exe.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            let parent = exe.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            seen_paths.insert(exe_str.to_lowercase());
            all_games.push(ScannedGame {
                exe_path: exe_str,
                suggested_title: exe_to_title(&file_name),
                install_path: parent,
                detected_launcher: launcher,
            });
        }
        let _ = app.emit("scan-progress", ScanProgress {
            scanned_dirs: (i + 2) as u32,
            total_dirs: paths.len() as u32 + 1,
            found_games: all_games.len() as u32,
        });
    }

    Ok(all_games)
}
