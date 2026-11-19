// Entry point desktop sahaja (untuk test cepat di PC). Android & iOS guna lib.rs terus.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jm_operations_lib::run()
}
