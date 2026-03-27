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

    // Block small exes (< 1MB) — real games are larger
    if let Ok(meta) = std::fs::metadata(exe_path) {
        if meta.len() < 1_000_000 {
            return true;
        }
    }

    // Block if exe name contains utility keywords
    let utility_keywords = [
        "uninstall", "uninst", "setup", "install", "update", "patch",
        "redist", "vcredist", "dxsetup", "dotnet",
        "crash", "report", "helper", "tool", "util",
        "config", "settings", "preference", "diagnostic",
        "repair", "fix", "clean", "remove",
        "loader", "injector", "trainer", "cheat",
        "server", "dedicated", "service", "daemon", "host",
        "editor", "sdk", "debug", "test", "benchmark",
        "tutorial", "sample", "demo_tool",
        "steamwebhelper", "cefsubprocess", "subprocess",
    ];
    for kw in utility_keywords {
        if file_name.contains(kw) {
            return true;
        }
    }

    false
}

/// Score how likely a registry entry is to be a game (0-100)
/// High score = likely a game, low score = likely not
fn game_likelihood_score(display_name: &str, install_path: &Path, subkey: &RegKey) -> u32 {
    let name_lower = display_name.to_lowercase();
    let path_lower = install_path.to_string_lossy().to_lowercase();
    let mut score: u32 = 50; // start neutral

    // Strong positive: installed in a known game directory
    let game_path_indicators = ["games", "steamapps", "epic games", "gog galaxy",
        "origin games", "ea games", "playnite", "game"];
    for ind in game_path_indicators {
        if path_lower.contains(ind) { score += 30; break; }
    }

    // Positive: has game-like name patterns
    let game_name_words = ["game", "edition", "remastered", "definitive",
        "deluxe", "goty", "chapter", "episode", "saga",
        "simulator", "tycoon", "craft", "quest", "legends",
        "warfare", "combat", "battle", "arena", "rpg"];
    for word in game_name_words {
        if name_lower.contains(word) { score += 15; break; }
    }

    // Negative: has utility/tool name patterns
    let tool_words = ["driver", "runtime", "redistribut", "sdk", "framework",
        "update", "hotfix", "service pack", "tool", "utility",
        "manager", "monitor", "viewer", "reader", "converter",
        "security", "antivirus", "firewall", "backup",
        "engine", "development", "studio", "ide",
        "office", "document", "spreadsheet",
        "cheat", "trainer", "hack", "inject", "mod menu"];
    for word in tool_words {
        if name_lower.contains(word) { score = score.saturating_sub(25); }
    }

    // Check registry for "game" or related URLInfoAbout hints
    if let Ok(url) = subkey.get_value::<String, _>("URLInfoAbout") {
        let url_lower = url.to_lowercase();
        if url_lower.contains("store.steampowered") || url_lower.contains("epicgames")
            || url_lower.contains("gog.com") || url_lower.contains("ea.com/games") {
            score += 30;
        }
    }

    // Negative: very short display name (likely a tool, e.g. "7-Zip")
    if display_name.len() < 4 { score = score.saturating_sub(20); }

    // Negative: publisher is a known non-game entity (already filtered, but double-check)
    if let Ok(pub_name) = subkey.get_value::<String, _>("Publisher") {
        let pub_lower = pub_name.to_lowercase();
        let game_publishers = ["electronic arts", "ea ", "ubisoft", "activision",
            "blizzard", "bethesda", "valve", "rockstar", "2k games",
            "square enix", "capcom", "sega", "bandai namco", "cd projekt",
            "warner bros", "thq", "deep silver", "devolver", "team17",
            "paradox", "focus entertainment", "505 games", "nacon"];
        for gp in game_publishers {
            if pub_lower.contains(gp) { score += 20; break; }
        }
    }

    score.min(100)
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
fn scan_registry() -> Vec<(String, PathBuf, u32)> {
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

                        let loc_path = PathBuf::from(&loc);

                        // Filter by publisher — skip known non-game publishers
                        let publisher: Result<String, _> = subkey.get_value("Publisher");
                        if let Ok(pub_name) = &publisher {
                            let pub_lower = pub_name.to_lowercase();
                            if BLOCKED_PUBLISHERS.iter().any(|bp| pub_lower.contains(bp)) {
                                continue;
                            }
                        }

                        // Score-based filtering: skip if score < 35
                        let score = game_likelihood_score(&name, &loc_path, &subkey);
                        if score < 35 { continue; }

                        results.push((name, loc_path, score));
                    }
                }
            }
        }
    }
    results
}

#[cfg(not(target_os = "windows"))]
fn scan_registry() -> Vec<(String, PathBuf, u32)> {
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
    let mut seen_install_dirs: HashSet<String> = HashSet::new();

    for (name, install_path, _score) in &registry_entries {
        let launcher = detect_launcher(install_path);
        if let Some(ref l) = launcher {
            if exclude_set.contains(l) { continue; }
        }

        let dir_key = install_path.to_string_lossy().to_lowercase();
        if seen_install_dirs.contains(&dir_key) { continue; }
        seen_install_dirs.insert(dir_key);

        let exes = scan_directory(install_path, 2);
        let valid_exes: Vec<_> = exes.into_iter().filter(|e| !is_blocked_exe(e)).collect();
        if valid_exes.is_empty() { continue; }

        let available: Vec<super::models::ExeOption> = valid_exes.iter().map(|e| {
            let size = std::fs::metadata(e).map(|m| m.len()).unwrap_or(0);
            super::models::ExeOption {
                path: e.to_string_lossy().to_string(),
                file_name: e.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                size_bytes: size,
            }
        }).collect();

        // Pick best default: prefer exe whose name matches game title, else largest
        let name_lower = name.to_lowercase().replace(['\'', ':', '-', ' '], "");
        let best = valid_exes.iter()
            .max_by_key(|e| {
                let fname = e.file_stem().map(|s| s.to_string_lossy().to_lowercase().replace(['_', '-', ' '], "")).unwrap_or_default();
                let size = std::fs::metadata(e).map(|m| m.len()).unwrap_or(0);
                let name_match: u64 = if name_lower.contains(&fname) || fname.contains(&name_lower) { 1_000_000_000_000 } else { 0 };
                name_match + size
            })
            .unwrap();

        let exe_str = best.to_string_lossy().to_string();
        seen_paths.insert(exe_str.to_lowercase());
        all_games.push(ScannedGame {
            exe_path: exe_str,
            suggested_title: name.clone(),
            install_path: install_path.to_string_lossy().to_string(),
            detected_launcher: launcher.clone(),
            available_exes: available,
        });
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
        // Group exes by parent directory
        let mut by_parent: std::collections::HashMap<String, Vec<PathBuf>> = std::collections::HashMap::new();
        for exe in exes {
            if is_blocked_exe(&exe) { continue; }
            let parent = exe.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            by_parent.entry(parent.clone()).or_default().push(exe);
        }

        for (parent_str, group) in &by_parent {
            if group.is_empty() { continue; }
            let dir_key = parent_str.to_lowercase();
            if seen_install_dirs.contains(&dir_key) { continue; }
            seen_install_dirs.insert(dir_key);

            let available: Vec<super::models::ExeOption> = group.iter().map(|e| {
                let size = std::fs::metadata(e).map(|m| m.len()).unwrap_or(0);
                super::models::ExeOption {
                    path: e.to_string_lossy().to_string(),
                    file_name: e.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                    size_bytes: size,
                }
            }).collect();

            // Folder name is our best guess for game title
            let folder_name = Path::new(parent_str).file_name()
                .map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            let folder_lower = folder_name.to_lowercase().replace(['\'', ':', '-', ' ', '_'], "");

            // Best exe: name closest to folder name, then largest
            let best = group.iter()
                .max_by_key(|e| {
                    let fname = e.file_stem().map(|s| s.to_string_lossy().to_lowercase().replace(['_', '-', ' '], "")).unwrap_or_default();
                    let size = std::fs::metadata(e).map(|m| m.len()).unwrap_or(0);
                    let name_match: u64 = if folder_lower.contains(&fname) || fname.contains(&folder_lower) { 1_000_000_000_000 } else { 0 };
                    name_match + size
                })
                .unwrap();

            let exe_str = best.to_string_lossy().to_string();
            if seen_paths.contains(&exe_str.to_lowercase()) { continue; }
            let launcher = detect_launcher(best);
            if let Some(ref l) = launcher {
                if exclude_set.contains(l) { continue; }
            }
            seen_paths.insert(exe_str.to_lowercase());
            all_games.push(ScannedGame {
                exe_path: exe_str,
                suggested_title: exe_to_title(&best.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()),
                install_path: parent_str.clone(),
                detected_launcher: launcher,
                available_exes: available,
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
