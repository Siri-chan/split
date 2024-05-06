// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs::File, io::{BufRead, BufReader, Write}};

use nix::{sys::stat, unistd};
use tauri::Manager;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![mkpipe])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[derive(Clone, serde::Serialize)]
struct PipePayload {
message: String,
}

#[tauri::command]
async fn mkpipe(location: &str, app_handle: tauri::AppHandle) -> Result<(),()> {
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
            app_handle.emit_all("pipe_event", PipePayload{message: format!("{}", b)}).unwrap();
            b.clear();
            f.write_all(&[]).unwrap();
        }
    }    
}

