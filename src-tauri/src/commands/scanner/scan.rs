use super::models::{ScannedGame, ScanProgress, DriveInfo};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

/// List all available drives on Windows
#[tauri::command]
pub fn list_drives() -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // Check drive letters A-Z
        for letter in b'A'..=b'Z' {
            let drive_path = format!("{}:\\", letter as char);
            let path = Path::new(&drive_path);
            if !path.exists() { continue; }

            // Get disk space using fs2
            let (total, free) = match fs2::available_space(path) {
                Ok(free) => {
                    let total = fs2::total_space(path).unwrap_or(0);
                    (total, free)
                }
                Err(_) => continue, // Skip inaccessible drives
            };

            // Get volume label from registry or default
            let label = get_volume_label(&drive_path).unwrap_or_else(|| {
                if letter == b'C' { "Windows".to_string() }
                else { "Yerel Disk".to_string() }
            });

            drives.push(DriveInfo {
                letter: format!("{}:", letter as char),
                label,
                total_bytes: total,
                free_bytes: free,
            });
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        drives.push(DriveInfo {
            letter: "/".to_string(),
            label: "Root".to_string(),
            total_bytes: 0,
            free_bytes: 0,
        });
    }

    Ok(drives)
}

#[cfg(target_os = "windows")]
fn get_volume_label(drive_path: &str) -> Option<String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let wide_path: Vec<u16> = OsStr::new(drive_path).encode_wide().chain(std::iter::once(0)).collect();
    let mut label_buf: Vec<u16> = vec![0u16; 256];
    let mut fs_buf: Vec<u16> = vec![0u16; 256];

    let success = unsafe {
        windows_sys::Win32::Storage::FileSystem::GetVolumeInformationW(
            wide_path.as_ptr(),
            label_buf.as_mut_ptr(),
            label_buf.len() as u32,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            fs_buf.as_mut_ptr(),
            fs_buf.len() as u32,
        )
    };

    if success != 0 {
        let len = label_buf.iter().position(|&c| c == 0).unwrap_or(0);
        let label = String::from_utf16_lossy(&label_buf[..len]);
        if label.is_empty() { None } else { Some(label) }
    } else {
        None
    }
}

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

/// Compute confidence (0-100) that a result is actually a game
fn compute_confidence(title: &str, install_path: &Path, launcher: &Option<String>, best_exe_size: u64) -> u32 {
    let mut score: i32 = 30; // start slightly below neutral
    let path_lower = install_path.to_string_lossy().to_lowercase();
    let title_lower = title.to_lowercase();

    // === STRONG POSITIVE: Known launcher detected ===
    if launcher.is_some() { score += 40; }

    // === POSITIVE: Path contains game-related keywords ===
    let game_path_words = ["games", "game", "oyun", "steamapps", "epic games",
        "gog galaxy", "origin games", "ea games", "playnite",
        "xbox", "battle.net", "riot games"];
    for w in game_path_words {
        if path_lower.contains(w) { score += 25; break; }
    }

    // === POSITIVE: Title contains game-like words ===
    let game_title_words = ["edition", "remastered", "definitive", "deluxe", "goty",
        "chapter", "episode", "saga", "simulator", "tycoon", "craft",
        "quest", "legends", "warfare", "combat", "battle", "arena",
        "rpg", "mmorpg", "souls", "survival", "sandbox", "rogue",
        "racing", "rally", "football", "soccer", "nba", "fifa",
        "minecraft", "fortnite", "valorant", "overwatch", "dota",
        "witcher", "assassin", "hitman", "tomb raider", "resident evil",
        "final fantasy", "dark souls", "elden ring", "cyberpunk",
        "grand theft", "gta", "red dead", "call of duty", "cod",
        "battlefield", "counter-strike", "csgo", "cs2", "halo",
        "destiny", "world of warcraft", "diablo", "starcraft",
        "civilization", "total war", "europa universalis", "crusader kings",
        "cities skylines", "factorio", "satisfactory", "subnautica",
        "terraria", "stardew", "hollow knight", "celeste", "ori ",
        "portal", "half-life", "left 4 dead", "team fortress",
        "rocket league", "apex legends", "pubg", "warzone",
        "fallout", "skyrim", "elder scrolls", "mass effect",
        "dragon age", "baldur", "divinity", "pillars of eternity",
        "pathfinder", "no man", "sea of thieves", "deep rock",
        "monster hunter", "devil may cry", "metal gear", "sekiro",
        "ghost of", "god of war", "spider-man", "horizon",
        "uncharted", "last of us", "death stranding", "detroit",
        "far cry", "watch dogs", "the crew", "anno ", "splinter cell",
        "robocop", "need for speed", "forza", "gran turismo",
        "flight simulator", "ace combat", "war thunder", "world of tanks",
        "league of legends", "smite", "paladins", "dead by daylight"];
    for w in game_title_words {
        if title_lower.contains(w) { score += 25; break; }
    }

    // === POSITIVE: Large exe (games tend to be big) ===
    if best_exe_size > 500_000_000 { score += 15; }      // > 500MB
    else if best_exe_size > 100_000_000 { score += 10; }  // > 100MB
    else if best_exe_size > 20_000_000 { score += 5; }    // > 20MB
    else if best_exe_size < 5_000_000 { score -= 15; }    // < 5MB — probably not a game

    // === POSITIVE: Dedicated game folder (not nested in Program Files root) ===
    let depth = path_lower.split(['\\', '/']).count();
    if depth >= 4 { score += 5; } // deeper = more likely a dedicated game install

    // === NEGATIVE: Title has tool/utility patterns ===
    let tool_words = ["driver", "runtime", "redistribut", "sdk", "framework",
        "update", "hotfix", "service pack", "tool", "utility", "manager",
        "monitor", "viewer", "reader", "converter", "security", "antivirus",
        "firewall", "backup", "development", "studio", "ide", "office",
        "document", "creative cloud", "visual c++", "directx", ".net"];
    for w in tool_words {
        if title_lower.contains(w) { score -= 30; break; }
    }

    score.clamp(0, 100) as u32
}

/// Build ExeOption list and pick best exe for a set of valid exes
fn build_exe_options(valid_exes: &[PathBuf], title_hint: &str) -> (Vec<super::models::ExeOption>, PathBuf) {
    let available: Vec<super::models::ExeOption> = valid_exes.iter().map(|e| {
        let size = std::fs::metadata(e).map(|m| m.len()).unwrap_or(0);
        super::models::ExeOption {
            path: e.to_string_lossy().to_string(),
            file_name: e.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
            size_bytes: size,
        }
    }).collect();

    let hint_lower = title_hint.to_lowercase().replace(['\'', ':', '-', ' ', '_'], "");
    let best = valid_exes.iter()
        .max_by_key(|e| {
            let fname = e.file_stem().map(|s| s.to_string_lossy().to_lowercase().replace(['_', '-', ' '], "")).unwrap_or_default();
            let size = std::fs::metadata(e).map(|m| m.len()).unwrap_or(0);
            let name_match: u64 = if !hint_lower.is_empty() && (hint_lower.contains(&fname) || fname.contains(&hint_lower)) { 1_000_000_000_000 } else { 0 };
            name_match + size
        })
        .unwrap()
        .clone();

    (available, best)
}

#[tauri::command]
pub async fn scan_games(
    app: AppHandle,
    db: tauri::State<'_, super::db::Db>,
    paths: Vec<String>,
    exclude_launchers: Vec<String>,
) -> Result<Vec<ScannedGame>, String> {
    let exclude_set: HashSet<String> = exclude_launchers.into_iter()
        .map(|l| l.to_lowercase())
        .collect();

    // Load already-known exe paths from DB to skip them
    let known_exes: HashSet<String> = {
        let conn = db.lock().unwrap();
        let mut stmt = conn.prepare("SELECT LOWER(exe_path) FROM games").unwrap();
        stmt.query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };

    let mut all_games: Vec<ScannedGame> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();
    let mut seen_install_dirs: HashSet<String> = HashSet::new();

    // Phase 1: Registry scan
    let registry_entries = scan_registry();
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

        let (available, best) = build_exe_options(&valid_exes, name);
        let exe_str = best.to_string_lossy().to_string();

        // Skip if already in library
        if known_exes.contains(&exe_str.to_lowercase()) { continue; }
        if seen_paths.contains(&exe_str.to_lowercase()) { continue; }
        seen_paths.insert(exe_str.to_lowercase());

        let best_size = std::fs::metadata(&best).map(|m| m.len()).unwrap_or(0);
        let confidence = compute_confidence(name, install_path, &launcher, best_size);

        all_games.push(ScannedGame {
            exe_path: exe_str,
            suggested_title: name.clone(),
            install_path: install_path.to_string_lossy().to_string(),
            detected_launcher: launcher,
            available_exes: available,
            confidence,
        });
    }

    let _ = app.emit("scan-progress", ScanProgress {
        scanned_dirs: 1,
        total_dirs: paths.len() as u32 + 1,
        found_games: all_games.len() as u32,
    });

    // Phase 2: Filesystem scan
    for (i, path_str) in paths.iter().enumerate() {
        let dir = Path::new(path_str);
        if !dir.exists() || !dir.is_dir() { continue; }
        let exes = scan_directory(dir, 4);

        let mut by_parent: std::collections::HashMap<String, Vec<PathBuf>> = std::collections::HashMap::new();
        for exe in exes {
            if is_blocked_exe(&exe) { continue; }
            let parent = exe.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            by_parent.entry(parent).or_default().push(exe);
        }

        for (parent_str, group) in &by_parent {
            if group.is_empty() { continue; }
            let dir_key = parent_str.to_lowercase();
            if seen_install_dirs.contains(&dir_key) { continue; }
            seen_install_dirs.insert(dir_key);

            let folder_name = Path::new(parent_str).file_name()
                .map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

            let (available, best) = build_exe_options(&group, &folder_name);
            let exe_str = best.to_string_lossy().to_string();

            if known_exes.contains(&exe_str.to_lowercase()) { continue; }
            if seen_paths.contains(&exe_str.to_lowercase()) { continue; }

            let launcher = detect_launcher(&best);
            if let Some(ref l) = launcher {
                if exclude_set.contains(l) { continue; }
            }

            seen_paths.insert(exe_str.to_lowercase());
            let title = exe_to_title(&best.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default());
            let best_size = std::fs::metadata(&best).map(|m| m.len()).unwrap_or(0);
            let confidence = compute_confidence(&title, Path::new(parent_str), &launcher, best_size);

            all_games.push(ScannedGame {
                exe_path: exe_str,
                suggested_title: title,
                install_path: parent_str.clone(),
                detected_launcher: launcher,
                available_exes: available,
                confidence,
            });
        }

        let _ = app.emit("scan-progress", ScanProgress {
            scanned_dirs: (i + 2) as u32,
            total_dirs: paths.len() as u32 + 1,
            found_games: all_games.len() as u32,
        });
    }

    // Sort: highest confidence first
    all_games.sort_by(|a, b| b.confidence.cmp(&a.confidence));

    Ok(all_games)
}
