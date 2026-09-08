use std::net::TcpStream;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

const BACKEND_PORT: &str = "4115";
const BACKEND_STARTUP_TIMEOUT: Duration = Duration::from_secs(30);

/// The backend process, however it was started. Dropping either variant
/// leaves the child running, so it must be killed explicitly on exit.
enum Backend {
    /// `uv run uvicorn`, spawned straight from the source checkout.
    Dev(std::process::Child),
    /// The frozen PyInstaller binary, spawned as a Tauri sidecar.
    Sidecar(CommandChild),
}

impl Backend {
    fn kill(self) {
        match self {
            Backend::Dev(mut child) => {
                let _ = child.kill();
            }
            Backend::Sidecar(child) => {
                let _ = child.kill();
            }
        }
    }
}

fn spawn_dev_backend() -> std::io::Result<std::process::Child> {
    // Invoke the venv's own uvicorn directly rather than through `uv run`:
    // `uv run` spawns uvicorn as a *child of itself*, so killing it on quit
    // orphans the actual server. This keeps it to one process we can kill.
    let backend_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../backend");
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let uvicorn_bin = if cfg!(windows) {
        backend_dir.join(".venv/Scripts/uvicorn.exe")
    } else {
        backend_dir.join(".venv/bin/uvicorn")
    };
    std::process::Command::new(uvicorn_bin)
        .args(["tutor_os.server:app", "--port", BACKEND_PORT, "--reload"])
        .current_dir(&backend_dir)
        .env("TUTOR_OS_ROOT", repo_root)
        .spawn()
}

/// Gives the packaged backend a normal-looking project root to run against:
/// copies the bundled frontend + agent skills into the app's data dir the
/// first time the app runs there. `backend/storage.py` already knows how to
/// use an arbitrary root via `TUTOR_OS_ROOT`; workspace/db files are created
/// under it lazily by the backend itself.
fn seed_app_data(app: &tauri::AppHandle, data_dir: &Path) -> std::io::Result<()> {
    if data_dir.join("frontend").exists() {
        return Ok(());
    }
    let seed_dir = app
        .path()
        .resolve("seed", tauri::path::BaseDirectory::Resource)
        .expect("bundled seed resources missing");
    copy_dir(&seed_dir.join("frontend"), &data_dir.join("frontend"))?;
    copy_dir(&seed_dir.join(".agents"), &data_dir.join(".agents"))?;
    if seed_dir.join("workspace").exists() {
        copy_dir(&seed_dir.join("workspace"), &data_dir.join("workspace"))?;
    }
    Ok(())
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let dst_path = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &dst_path)?;
        } else {
            std::fs::copy(entry.path(), dst_path)?;
        }
    }
    Ok(())
}

fn spawn_backend(app: &tauri::AppHandle) -> Backend {
    if cfg!(debug_assertions) {
        return Backend::Dev(
            spawn_dev_backend().expect("failed to start backend (is `uv` installed?)"),
        );
    }

    let data_dir = app.path().app_data_dir().expect("no app data dir");
    std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
    seed_app_data(app, &data_dir).expect("failed to seed app data dir");

    let (_, child) = app
        .shell()
        .sidecar("tutor-os-backend")
        .expect("sidecar binary not found")
        .env("TUTOR_OS_ROOT", data_dir.to_string_lossy().to_string())
        .env("PORT", BACKEND_PORT)
        .spawn()
        .expect("failed to start backend sidecar");
    Backend::Sidecar(child)
}

/// Blocks until the backend accepts connections on `BACKEND_PORT`, or until
/// `BACKEND_STARTUP_TIMEOUT` passes. Without this, the window's first (and
/// only) load attempt can race uvicorn's startup and land on a dead
/// connection — which webviews don't retry, so it just stays blank forever.
fn wait_for_backend() {
    let deadline = Instant::now() + BACKEND_STARTUP_TIMEOUT;
    while TcpStream::connect(("127.0.0.1", BACKEND_PORT.parse::<u16>().unwrap())).is_err() {
        if Instant::now() >= deadline {
            break;
        }
        std::thread::sleep(Duration::from_millis(150));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let backend = spawn_backend(app.handle());
            app.manage(Mutex::new(Some(backend)));

            wait_for_backend();
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(format!("http://localhost:{BACKEND_PORT}").parse()?),
            )
            .title("Tutor OS")
            .inner_size(1440.0, 940.0)
            .min_inner_size(1100.0, 720.0)
            .resizable(true)
            .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(backend) = app.state::<Mutex<Option<Backend>>>().lock().unwrap().take()
                {
                    backend.kill();
                }
            }
        });
}
