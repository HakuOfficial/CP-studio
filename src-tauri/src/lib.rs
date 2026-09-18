use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompilerDiagnostic {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompileResult {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub compile_time_ms: u64,
    pub binary_path: String,
    pub diagnostics: Vec<CompilerDiagnostic>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompileOptions {
    pub compiler_path: Option<String>,
    pub cpp_standard: Option<String>,
    pub optimization: Option<String>,
    pub extra_flags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum Verdict { AC, WA, TLE, MLE, RE, CE }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RunResult {
    pub verdict: Verdict,
    pub stdout: String,
    pub stderr: String,
    pub execution_time_ms: u64,
    pub memory_kb: u64,
    pub exit_code: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestCase {
    pub id: String,
    pub name: String,
    pub input: String,
    pub expected_output: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestCaseResult {
    pub id: String,
    pub verdict: Verdict,
    pub actual_output: String,
    pub stderr: String,
    pub execution_time_ms: u64,
    pub memory_kb: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StressIteration {
    pub index: u32,
    pub seed: u64,
    pub input: String,
    pub solution_output: String,
    pub brute_output: String,
    pub verdict: Verdict,
    pub time_ms: u64,
    pub memory_kb: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompilerInfo {
    pub name: String,
    pub path: String,
    pub version: String,
}

#[derive(Debug, Serialize)]
pub struct BackendStatus {
    pub ready: bool,
    pub app: String,
    pub version: String,
    pub platform: String,
}

fn parse_diagnostics(stderr: &str) -> Vec<CompilerDiagnostic> {
    // GCC/Clang format: <file>:<line>:<column>: <message>.
    // Do not split from the left because Windows drive letters contain ':' (C:\...).
    stderr.lines().filter_map(|text| {
        for (file_end, ch) in text.char_indices() {
            if ch != ':' { continue; }
            let after_file = &text[file_end + 1..];
            let Some(line_end_rel) = after_file.find(':') else { continue; };
            let line_text = after_file[..line_end_rel].trim();
            let Ok(line_no) = line_text.parse::<u32>() else { continue; };

            let after_line = &after_file[line_end_rel + 1..];
            let Some(col_end_rel) = after_line.find(':') else { continue; };
            let col_text = after_line[..col_end_rel].trim();
            let Ok(column) = col_text.parse::<u32>() else { continue; };

            let file = text[..file_end].trim();
            let message = after_line[col_end_rel + 1..].trim();
            if file.is_empty() || message.is_empty() { continue; }
            return Some(CompilerDiagnostic {
                file: file.to_string(),
                line: line_no,
                column,
                message: message.to_string(),
            });
        }
        None
    }).collect()
}

fn cpp_binary(dir: &Path, name: &str) -> PathBuf {
    #[cfg(windows)] { return dir.join(format!("{}.exe", name)); }
    #[cfg(not(windows))] { dir.join(name) }
}

fn compile_cpp(source_code: &str, source_name: &str, binary_name: &str, output_dir: &str, options: Option<CompileOptions>) -> Result<CompileResult, String> {
    let dir = PathBuf::from(output_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create output directory: {e}"))?;
    let src = dir.join(source_name);
    let bin = cpp_binary(&dir, binary_name);
    fs::write(&src, source_code).map_err(|e| format!("Cannot write source file: {e}"))?;

    let opts = options.unwrap_or(CompileOptions { compiler_path: None, cpp_standard: None, optimization: None, extra_flags: None });
    let compiler = opts.compiler_path.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "g++".into());
    let standard = opts.cpp_standard.unwrap_or_else(|| "gnu++20".into());
    let optimization = opts.optimization.unwrap_or_else(|| "-O2".into());

    let mut cmd = Command::new(&compiler);
    configure_hidden(&mut cmd);
    cmd.arg(&src).arg(format!("-std={standard}"));
    if !optimization.trim().is_empty() { cmd.arg(optimization); }
    cmd.arg("-pipe");
    if let Some(flags) = opts.extra_flags { for flag in flags { if !flag.trim().is_empty() { cmd.arg(flag); } } }
    cmd.arg("-o").arg(&bin);

    let start = Instant::now();
    let output = cmd.output().map_err(|e| format!("C++ compiler not found or failed to start at '{compiler}': {e}"))?;
    let compile_time_ms = start.elapsed().as_millis() as u64;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let success = output.status.success();
    Ok(CompileResult {
        success,
        exit_code: output.status.code().unwrap_or(-1),
        stdout,
        diagnostics: parse_diagnostics(&stderr),
        stderr,
        compile_time_ms,
        binary_path: if success { bin.to_string_lossy().to_string() } else { String::new() },
    })
}

fn configure_hidden(cmd: &mut Command) {
    // CP Studio is a GUI application in release builds. Without CREATE_NO_WINDOW,
    // every compiler/helper/contest executable can briefly create a console window
    // on Windows. That causes the visible "flash" users reported after packaging.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}


#[cfg(windows)]
fn apply_no_redirection_bitmap(window: &tauri::WebviewWindow) -> Result<(), String> {
    // Stable Tauri 2.11.x does not yet accept `noRedirectionBitmap` in
    // tauri.conf.json. Keep the exact Windows behavior by applying
    // WS_EX_NOREDIRECTIONBITMAP before the initially-hidden window is shown.
    // This avoids the transparent-window startup white flash without moving
    // CP Studio onto an unreleased/dev Tauri build.
    use std::ffi::c_void;

    #[link(name = "user32")]
    extern "system" {
        fn GetWindowLongPtrW(hwnd: *mut c_void, index: i32) -> isize;
        fn SetWindowLongPtrW(hwnd: *mut c_void, index: i32, value: isize) -> isize;
        fn SetWindowPos(
            hwnd: *mut c_void,
            insert_after: *mut c_void,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            flags: u32,
        ) -> i32;
    }

    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_NOREDIRECTIONBITMAP: isize = 0x0020_0000;
    const SWP_NOSIZE: u32 = 0x0001;
    const SWP_NOMOVE: u32 = 0x0002;
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_FRAMECHANGED: u32 = 0x0020;

    let native = window
        .hwnd()
        .map_err(|e| format!("Cannot obtain CP Studio HWND: {e}"))?;
    let hwnd = native.0 as *mut c_void;

    unsafe {
        let old_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let new_style = old_style | WS_EX_NOREDIRECTIONBITMAP;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);

        // Force DWM/non-client state to observe the updated extended style.
        let ok = SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
        if ok == 0 {
            return Err(format!(
                "Failed to apply WS_EX_NOREDIRECTIONBITMAP: {}",
                std::io::Error::last_os_error()
            ));
        }
    }

    Ok(())
}

#[cfg(windows)]
mod win_job {
    use std::ffi::c_void;
    use std::mem::{size_of, zeroed};
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use std::ptr::null_mut;

    type Handle = *mut c_void;
    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS: i32 = 9;
    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x0000_2000;

    #[repr(C)]
    #[derive(Default)]
    struct IoCounters {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    #[derive(Default)]
    struct JobObjectBasicLimitInformation {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: u32,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: u32,
        affinity: usize,
        priority_class: u32,
        scheduling_class: u32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct JobObjectExtendedLimitInformation {
        basic_limit_information: JobObjectBasicLimitInformation,
        io_info: IoCounters,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }

    #[repr(C)]
    struct ProcessMemoryCountersEx {
        cb: u32,
        page_fault_count: u32,
        peak_working_set_size: usize,
        working_set_size: usize,
        quota_peak_paged_pool_usage: usize,
        quota_paged_pool_usage: usize,
        quota_peak_non_paged_pool_usage: usize,
        quota_non_paged_pool_usage: usize,
        pagefile_usage: usize,
        peak_pagefile_usage: usize,
        private_usage: usize,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateJobObjectW(job_attributes: *const c_void, name: *const u16) -> Handle;
        fn SetInformationJobObject(job: Handle, info_class: i32, info: *const c_void, len: u32) -> i32;
        fn QueryInformationJobObject(job: Handle, info_class: i32, info: *mut c_void, len: u32, return_len: *mut u32) -> i32;
        fn AssignProcessToJobObject(job: Handle, process: Handle) -> i32;
        fn TerminateJobObject(job: Handle, exit_code: u32) -> i32;
        fn CloseHandle(handle: Handle) -> i32;
    }

    #[link(name = "psapi")]
    extern "system" {
        fn GetProcessMemoryInfo(process: Handle, counters: *mut c_void, cb: u32) -> i32;
    }

    pub struct ProcessJob {
        handle: Handle,
    }

    impl ProcessJob {
        pub fn attach(child: &Child) -> Option<Self> {
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if handle.is_null() { return None; }

                let mut info: JobObjectExtendedLimitInformation = zeroed();
                info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                if SetInformationJobObject(
                    handle,
                    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS,
                    &info as *const _ as *const c_void,
                    size_of::<JobObjectExtendedLimitInformation>() as u32,
                ) == 0 {
                    CloseHandle(handle);
                    return None;
                }

                let process = child.as_raw_handle() as Handle;
                if AssignProcessToJobObject(handle, process) == 0 {
                    CloseHandle(handle);
                    return None;
                }
                Some(Self { handle })
            }
        }

        pub fn peak_memory_kb(&self) -> u64 {
            unsafe {
                let mut info: JobObjectExtendedLimitInformation = zeroed();
                if QueryInformationJobObject(
                    self.handle,
                    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS,
                    &mut info as *mut _ as *mut c_void,
                    size_of::<JobObjectExtendedLimitInformation>() as u32,
                    null_mut(),
                ) != 0 {
                    return (info.peak_job_memory_used.max(info.peak_process_memory_used) / 1024) as u64;
                }
            }
            0
        }

        pub fn terminate(&self) -> bool {
            unsafe { TerminateJobObject(self.handle, 1) != 0 }
        }
    }

    impl Drop for ProcessJob {
        fn drop(&mut self) {
            unsafe { let _ = CloseHandle(self.handle); }
        }
    }

    pub fn child_memory_kb(child: &Child) -> u64 {
        unsafe {
            let mut counters: ProcessMemoryCountersEx = zeroed();
            counters.cb = size_of::<ProcessMemoryCountersEx>() as u32;
            if GetProcessMemoryInfo(
                child.as_raw_handle() as Handle,
                &mut counters as *mut _ as *mut c_void,
                counters.cb,
            ) != 0 {
                // Private usage is closest to contest-style committed memory.
                // Working set is included as a fallback because some tiny/short
                // processes do not update PrivateUsage immediately.
                return (counters.private_usage.max(counters.working_set_size) / 1024) as u64;
            }
        }
        0
    }
}

#[cfg(windows)]
use win_job::ProcessJob;
#[cfg(not(windows))]
struct ProcessJob;

fn create_process_job(child: &Child) -> Option<ProcessJob> {
    #[cfg(windows)] { return ProcessJob::attach(child); }
    #[cfg(not(windows))] { let _ = child; None }
}

fn sample_memory_kb(pid: u32, child: &Child, job: Option<&ProcessJob>) -> u64 {
    #[cfg(windows)]
    {
        let from_job = job.map(|j| j.peak_memory_kb()).unwrap_or(0);
        return from_job.max(win_job::child_memory_kb(child));
    }
    #[cfg(target_os = "linux")]
    {
        let p = format!("/proc/{pid}/status");
        if let Ok(s) = fs::read_to_string(p) {
            for key in ["VmHWM:", "VmRSS:"] {
                if let Some(line) = s.lines().find(|l| l.starts_with(key)) {
                    if let Some(v) = line.split_whitespace().nth(1).and_then(|x| x.parse::<u64>().ok()) { return v; }
                }
            }
        }
    }
    #[cfg(all(not(windows), not(target_os = "linux")))]
    { let _ = (pid, child, job); }
    0
}

fn terminate_process_tree(child: &mut Child, job: Option<&ProcessJob>) {
    #[cfg(windows)]
    {
        if let Some(job) = job {
            if job.terminate() { return; }
        }
    }
    let _ = child.kill();
}

static ACTIVE_PIDS: OnceLock<Mutex<HashSet<u32>>> = OnceLock::new();
fn active_pids() -> &'static Mutex<HashSet<u32>> { ACTIVE_PIDS.get_or_init(|| Mutex::new(HashSet::new())) }

fn run_process(executable: &str, args: &[String], stdin_data: &str, time_limit_ms: u64, memory_limit_mb: u64) -> RunResult {
    let start = Instant::now();
    let mut cmd = Command::new(executable);
    configure_hidden(&mut cmd);
    cmd.args(args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => return RunResult { verdict: Verdict::RE, stdout: String::new(), stderr: format!("Failed to start process '{executable}': {e}"), execution_time_ms: 0, memory_kb: 0, exit_code: -1 },
    };
    let pid = child.id();
    // On Windows the Job Object gives us fast, native peak-memory accounting
    // for the whole process tree and lets us terminate that tree without spawning
    // tasklist/taskkill every few milliseconds.
    let process_job = create_process_job(&child);
    if let Ok(mut set)=active_pids().lock(){ set.insert(pid); }

    if let Some(mut stdin) = child.stdin.take() {
        let input = stdin_data.as_bytes().to_vec();
        thread::spawn(move || { let _ = stdin.write_all(&input); });
    }
    let stdout_handle = child.stdout.take().map(|mut out| thread::spawn(move || { let mut b=Vec::new(); let _=out.read_to_end(&mut b); b }));
    let stderr_handle = child.stderr.take().map(|mut out| thread::spawn(move || { let mut b=Vec::new(); let _=out.read_to_end(&mut b); b }));

    let mut peak_kb = 0u64;
    let mut timed_out = false;
    let mut memory_exceeded = false;
    let status = loop {
        peak_kb = peak_kb.max(sample_memory_kb(pid, &child, process_job.as_ref()));
        if memory_limit_mb > 0 && peak_kb > memory_limit_mb.saturating_mul(1024) {
            memory_exceeded = true;
            terminate_process_tree(&mut child, process_job.as_ref());
            break child.wait().ok();
        }
        if start.elapsed().as_millis() as u64 > time_limit_ms {
            timed_out = true;
            terminate_process_tree(&mut child, process_job.as_ref());
            break child.wait().ok();
        }
        match child.try_wait() {
            Ok(Some(s)) => break Some(s),
            Ok(None) => thread::sleep(Duration::from_millis(5)),
            Err(_) => break child.wait().ok(),
        }
    };

    let stdout = stdout_handle.and_then(|h| h.join().ok()).map(|b| String::from_utf8_lossy(&b).to_string()).unwrap_or_default();
    let stderr = stderr_handle.and_then(|h| h.join().ok()).map(|b| String::from_utf8_lossy(&b).to_string()).unwrap_or_default();
    let execution_time_ms = start.elapsed().as_millis() as u64;
    let exit_code = status.and_then(|s| s.code()).unwrap_or(if timed_out || memory_exceeded { -1 } else { -2 });
    if let Ok(mut set)=active_pids().lock(){ set.remove(&pid); }
    let verdict = if memory_exceeded { Verdict::MLE } else if timed_out { Verdict::TLE } else if exit_code == 0 { Verdict::AC } else { Verdict::RE };
    RunResult { verdict, stdout, stderr, execution_time_ms, memory_kb: peak_kb, exit_code }
}

fn compare_output(actual: &str, expected: &str, mode: &str) -> bool {
    match mode {
        "exact" => actual == expected,
        "tokens" => actual.split_whitespace().eq(expected.split_whitespace()),
        _ => {
            let norm = |s: &str| s.lines().map(|l| l.trim_end()).collect::<Vec<_>>().join("\n").trim().to_string();
            norm(actual) == norm(expected)
        }
    }
}

#[tauri::command]
async fn compile_code(source_code: String, language: String, output_dir: String, options: Option<CompileOptions>) -> Result<CompileResult, String> {
    match language.as_str() {
        "cpp" => compile_cpp(&source_code, "solution.cpp", "solution", &output_dir, options),
        "python" => {
            let dir=PathBuf::from(&output_dir); fs::create_dir_all(&dir).map_err(|e|e.to_string())?; let src=dir.join("solution.py"); fs::write(&src, source_code).map_err(|e|e.to_string())?;
            Ok(CompileResult { success:true, exit_code:0, stdout:String::new(), stderr:String::new(), compile_time_ms:0, binary_path:src.to_string_lossy().to_string(), diagnostics:vec![] })
        },
        "java" => {
            let dir=PathBuf::from(&output_dir); fs::create_dir_all(&dir).map_err(|e|e.to_string())?; let src=dir.join("Main.java"); fs::write(&src, source_code).map_err(|e|e.to_string())?;
            let start=Instant::now(); let mut javac=Command::new("javac"); configure_hidden(&mut javac); let out=javac.arg(&src).output().map_err(|e|format!("javac not found: {e}"))?; let stderr=String::from_utf8_lossy(&out.stderr).to_string();
            Ok(CompileResult { success:out.status.success(), exit_code:out.status.code().unwrap_or(-1), stdout:String::from_utf8_lossy(&out.stdout).to_string(), diagnostics:parse_diagnostics(&stderr), stderr, compile_time_ms:start.elapsed().as_millis() as u64, binary_path:if out.status.success(){dir.to_string_lossy().to_string()}else{String::new()} })
        },
        _ => Err(format!("Unsupported language: {language}")),
    }
}

#[tauri::command]
async fn run_testcase(binary_path:String, language:String, input:String, expected_output:String, time_limit_ms:u64, memory_limit_mb:u64, compare_mode:Option<String>) -> Result<RunResult,String> {
    let args: Vec<String>;
    let exe: String;
    match language.as_str() {
        "python" => { exe=if cfg!(windows){"python".into()}else{"python3".into()}; args=vec![binary_path.clone()]; },
        "java" => { exe="java".into(); args=vec!["-cp".into(), binary_path.clone(), "Main".into()]; },
        _ => { exe=binary_path.clone(); args=vec![]; }
    }
    let mut r=run_process(&exe,&args,&input,time_limit_ms,memory_limit_mb);
    if r.verdict==Verdict::AC && !expected_output.is_empty() && !compare_output(&r.stdout,&expected_output,compare_mode.as_deref().unwrap_or("trim")) { r.verdict=Verdict::WA; }
    Ok(r)
}

#[tauri::command]
async fn run_all_testcases(binary_path:String, language:String, testcases:Vec<TestCase>, time_limit_ms:u64, memory_limit_mb:u64, compare_mode:Option<String>) -> Result<Vec<TestCaseResult>,String> {
    let mut results=Vec::with_capacity(testcases.len());
    for tc in testcases {
        let r=run_testcase(binary_path.clone(),language.clone(),tc.input.clone(),tc.expected_output.clone(),time_limit_ms,memory_limit_mb,compare_mode.clone()).await?;
        results.push(TestCaseResult{id:tc.id,verdict:r.verdict,actual_output:r.stdout,stderr:r.stderr,execution_time_ms:r.execution_time_ms,memory_kb:r.memory_kb});
    }
    Ok(results)
}

#[tauri::command]
async fn compile_generator(generator_code:String, output_dir:String, options:Option<CompileOptions>) -> Result<CompileResult,String> { compile_cpp(&generator_code,"generator.cpp","generator",&output_dir,options) }
#[tauri::command]
async fn compile_brute(brute_code:String, output_dir:String, options:Option<CompileOptions>) -> Result<CompileResult,String> { compile_cpp(&brute_code,"brute.cpp","brute",&output_dir,options) }

#[tauri::command]
async fn generate_input(generator_binary:String, seed:u64) -> Result<String,String> {
    let r=run_process(&generator_binary,&[seed.to_string()],"",5000,512);
    if r.verdict!=Verdict::AC { return Err(format!("Generator failed ({:?}): {}",r.verdict,r.stderr)); }
    Ok(r.stdout)
}

#[tauri::command]
async fn run_stress_test(solution_binary:String, brute_binary:String, generator_binary:String, iterations:u32, time_limit_ms:u64, memory_limit_mb:u64, start_seed:u64, compare_mode:Option<String>) -> Result<Vec<StressIteration>,String> {
    let mut results=Vec::new();
    for i in 0..iterations {
        let seed=start_seed+i as u64;
        let gen=run_process(&generator_binary,&[seed.to_string()],"",5000,512);
        if gen.verdict!=Verdict::AC { return Err(format!("Generator failed at seed {seed}: {}",gen.stderr)); }
        let input=gen.stdout;
        let sol=run_process(&solution_binary,&[],&input,time_limit_ms,memory_limit_mb);
        let brute=run_process(&brute_binary,&[],&input,time_limit_ms.saturating_mul(5).max(5000),memory_limit_mb.max(512));
        let verdict=if sol.verdict!=Verdict::AC {sol.verdict.clone()} else if brute.verdict!=Verdict::AC {Verdict::RE} else if compare_output(&sol.stdout,&brute.stdout,compare_mode.as_deref().unwrap_or("trim")){Verdict::AC}else{Verdict::WA};
        let bad=verdict!=Verdict::AC;
        results.push(StressIteration{index:i+1,seed,input,solution_output:sol.stdout,brute_output:brute.stdout,verdict,time_ms:sol.execution_time_ms,memory_kb:sol.memory_kb});
        if bad {break;}
    }
    Ok(results)
}

#[tauri::command]
async fn ping_backend() -> BackendStatus {
    BackendStatus {
        ready: true,
        app: "CP Studio".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        platform: std::env::consts::OS.into(),
    }
}

#[tauri::command]
async fn save_file(path:String, content:String)->Result<(),String>{ fs::write(path,content).map_err(|e|e.to_string()) }
#[tauri::command]
async fn read_file(path:String)->Result<String,String>{ fs::read_to_string(path).map_err(|e|e.to_string()) }
#[tauri::command]
async fn get_temp_dir()->Result<String,String>{ Ok(std::env::temp_dir().to_string_lossy().to_string()) }

fn compiler_info(path: &str, name: &str) -> Option<CompilerInfo> {
    let mut cmd = Command::new(path);
    configure_hidden(&mut cmd);
    let out = cmd.arg("--version").output().ok()?;
    if !out.status.success() { return None; }
    let version = String::from_utf8_lossy(&out.stdout).lines().next().unwrap_or("").trim().to_string();
    Some(CompilerInfo { name: name.into(), path: path.into(), version })
}

#[tauri::command]
async fn detect_compilers()->Result<Vec<CompilerInfo>,String>{
    let mut found=Vec::new();
    for (path, name) in [("g++", "GCC"), ("clang++", "Clang")] {
        if let Some(info) = compiler_info(path, name) { found.push(info); }
    }

    #[cfg(windows)]
    {
        let mut paths: Vec<(String, &str)> = vec![
            (r"C:\msys64\ucrt64\bin\g++.exe".into(), "GCC"),
            (r"C:\msys64\mingw64\bin\g++.exe".into(), "GCC"),
            (r"C:\msys64\clang64\bin\clang++.exe".into(), "Clang"),
            (r"C:\MinGW\bin\g++.exe".into(), "GCC"),
            (r"C:\Program Files\LLVM\bin\clang++.exe".into(), "Clang"),
        ];
        if let Ok(home) = std::env::var("USERPROFILE") {
            paths.push((format!(r"{}\scoop\apps\gcc\current\bin\g++.exe", home), "GCC"));
            paths.push((format!(r"{}\scoop\apps\llvm\current\bin\clang++.exe", home), "Clang"));
        }
        for (path, name) in paths {
            if Path::new(&path).exists() && !found.iter().any(|x| x.path.eq_ignore_ascii_case(&path)) {
                if let Some(info)=compiler_info(&path, name) { found.push(info); }
            }
        }
    }
    Ok(found)
}

#[tauri::command]
async fn stop_processes()->Result<(),String>{
    let pids=active_pids().lock().map_err(|_|"Process registry poisoned".to_string())?.iter().copied().collect::<Vec<_>>();
    for pid in pids {
        #[cfg(windows)] { let mut cmd=Command::new("taskkill"); configure_hidden(&mut cmd); let _=cmd.args(["/PID",&pid.to_string(),"/T","/F"]).output(); }
        #[cfg(unix)] { let _=Command::new("kill").args(["-9",&pid.to_string()]).output(); }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(){
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = app.get_webview_window("main").ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "CP Studio main window was not created")
            })?;

            #[cfg(windows)]
            apply_no_redirection_bitmap(&window).map_err(|e| {
                std::io::Error::new(std::io::ErrorKind::Other, e)
            })?;

            // Window starts hidden so WS_EX_NOREDIRECTIONBITMAP is applied
            // before the user sees the first frame.
            window.show()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ping_backend,compile_code,run_testcase,run_all_testcases,compile_generator,generate_input,compile_brute,run_stress_test,save_file,read_file,get_temp_dir,detect_compilers,stop_processes])
        .run(tauri::generate_context!()).expect("error while running CP Studio");
}
