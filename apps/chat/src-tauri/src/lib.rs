use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{Emitter, Listener};
use tokio::sync::oneshot;

static PUBLISH_REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
struct PublishIpfsState {
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<Result<String, String>>>>>,
}

#[derive(Serialize, Clone)]
struct PublishIpfsRequest {
    request_id: String,
    content: String,
}

#[derive(Deserialize, Debug)]
struct PublishIpfsResult {
    request_id: String,
    cid: Option<String>,
    error: Option<String>,
}

fn next_publish_request_id() -> String {
    format!("publish-{}", PUBLISH_REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed))
}

/// Publish content to IPFS via IPC event bridge to the frontend Helia node.
#[tauri::command]
async fn publish_ipfs(
    app: tauri::AppHandle,
    state: tauri::State<'_, PublishIpfsState>,
    content: String,
) -> Result<String, String> {
    println!("[BucksChat] Publishing content to IPFS: {}", &content[..content.len().min(60)]);
    let request_id = next_publish_request_id();
    let (tx, rx) = oneshot::channel::<Result<String, String>>();

    {
        let mut pending = state
            .pending
            .lock()
            .map_err(|_| "failed to acquire IPFS publish state lock".to_string())?;
        pending.insert(request_id.clone(), tx);
    }

    let payload = PublishIpfsRequest { request_id: request_id.clone(), content };

    if let Err(error) = app.emit("bucks://ipfs/publish", payload) {
        if let Ok(mut pending) = state.pending.lock() {
            pending.remove(&request_id);
        }
        return Err(format!("failed to emit IPFS publish event: {error}"));
    }

    match tokio::time::timeout(Duration::from_secs(15), rx).await {
        Ok(Ok(Ok(cid))) => Ok(cid),
        Ok(Ok(Err(error))) => Err(error),
        Ok(Err(_)) | Err(_) => {
            if let Ok(mut pending) = state.pending.lock() {
                pending.remove(&request_id);
            }
            Err("IPFS node not initialized or timed out".to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PublishIpfsState::default())
        .setup(|app| {
            let pending = app.state::<PublishIpfsState>().pending.clone();

            app.listen("bucks://ipfs/publish/result", move |event| {
                let payload = match serde_json::from_str::<PublishIpfsResult>(event.payload()) {
                    Ok(payload) => payload,
                    Err(error) => {
                        eprintln!("[BucksChat] Invalid IPFS publish result payload: {error}");
                        return;
                    }
                };

                let sender = match pending.lock() {
                    Ok(mut waiters) => waiters.remove(&payload.request_id),
                    Err(_) => None,
                };

                if let Some(sender) = sender {
                    let result = match (payload.cid, payload.error) {
                        (Some(cid), _) => Ok(cid),
                        (_, Some(error)) => Err(error),
                        _ => Err("IPFS publish failed".to_string()),
                    };
                    let _ = sender.send(result);
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![publish_ipfs])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
