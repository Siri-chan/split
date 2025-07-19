// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::File,
    io::{BufRead, BufReader, Write},
};

use nix::{sys::stat, unistd};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![mkpipe])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Clone, serde::Serialize)]
struct PipePayload {
    message: String,
}

#[tauri::command]
async fn mkpipe(location: &str, app_handle: tauri::AppHandle) -> Result<(), ()> {
    println!("{}", location);
    match unistd::mkfifo(location, stat::Mode::S_IRWXU) {
        Ok(_) => println!("created {:?}", location),
        Err(err) => println!("Error creating fifo: {}\n\n Continuing anyway, in hopes the fifo is just already in place", err),
    }
    let mut f = File::open(&location).unwrap();
    let mut b = String::new();
    let mut reader = BufReader::new(f.try_clone().unwrap());

    loop {
        let data = reader.read_line(&mut b).unwrap();
        if data != 0 {
            println!("recieved data from pipe: {}", b);
            app_handle
                .emit(
                    "pipe_event",
                    PipePayload {
                        message: format!("{}", b),
                    },
                )
                .unwrap();
            b.clear();
            f.write_all(&[]).unwrap();
        }
    }
}
