# CP Studio 0.3.6

CP Studio is a Tauri 2 + React + TypeScript + Monaco desktop IDE focused on competitive programming. The supplied Figma-generated layout is retained; the native judge is connected behind the existing Tests, Output, Generator and Stress panels.

## Important: desktop mode vs browser preview

Competitive-programming actions are native-only. **Do not use `npm run dev` to test C++ execution.** That command only starts Vite in a browser.

Use:

```powershell
npm install
npm run tauri dev
```

or run the built CP Studio desktop executable.

There is intentionally **no mock compiler/judge fallback**. If the UI is opened outside Tauri, CP Studio displays a native-backend warning and Compile/Run cannot fabricate AC results.

## C++ workflow

Run Current:

1. Take the current Monaco source.
2. Compile it through a Tauri command in the Rust backend.
3. Rust invokes the configured `g++.exe`/`clang++.exe` with an argument array.
4. Run the newly compiled executable with testcase stdin.
5. Capture stdout/stderr concurrently.
6. Enforce timeout/memory monitoring.
7. Compare actual output with expected output.
8. Return AC / WA / TLE / MLE / RE / CE.

Run All compiles the current source exactly once for that run, then executes every testcase against the same fresh binary. Editing source invalidates the previous binary so stale executables are not judged.

## Compiler setup

Settings supports:

- GNU++17 / GNU++20 / GNU++23
- Optimization level
- Extra flags
- Custom compiler path
- Auto Detect
- Browse for `g++.exe` / `clang++.exe`

Auto detection checks PATH plus common Windows locations including MSYS2 UCRT64/MinGW64/Clang64, MinGW, LLVM and common Scoop installations. If a detected compiler is not on PATH, CP Studio uses its full detected path.

Typical MSYS2 path:

```text
C:\msys64\ucrt64\bin\g++.exe
```

## Native runner behavior

- Windows `.exe` output path
- Concurrent stdout/stderr draining to avoid pipe deadlock
- Exit code 0 is not treated as RE
- Timeout process termination
- Windows process-tree termination via `taskkill /T /F`
- Peak-memory sampling
- Stop command terminates active native processes
- Exact / Trim whitespace / Token compare modes

Compiler diagnostics parse Windows paths such as `C:\...\solution.cpp:12:5:` correctly. Diagnostic entries in Output can move the Monaco cursor to the reported line/column.

## Generator and Stress Test

- GUI deterministic generator with seed
- C++ `generator.cpp`
- C++ brute-force editor
- Stress solution → generator → solution/brute → compare
- Counterexample seed/input/output inspection
- Add counterexample to Test Cases

The C++ generator and brute compiler now use the **same source currently displayed in Monaco**; there is no hidden empty/default source being compiled instead.

## Icons

UI action/status emoji have been replaced with `lucide-react` icons while preserving the existing layout. Valid Tauri bundle icons are also included under `src-tauri/icons/`.

## Windows build

Install:

- Node.js LTS
- Rust stable MSVC toolchain / Cargo
- Visual Studio Build Tools with **Desktop development with C++** + Windows SDK
- WebView2 Runtime
- GCC/Clang for compiling user C++

Then:

```powershell
npm install
npm run typecheck
npm run build
cargo check --manifest-path src-tauri\Cargo.toml
npm run tauri dev
```

Release build:

```powershell
npm run tauri build
```

Expected outputs are under:

```text
src-tauri\target\release\
src-tauri\target\release\bundle\
```

## Validation note

The preparation environment does not contain Rust/Cargo and npm package installation cannot complete against the registry, so a dependency-aware `cargo check` / Vite production build could not be run here. The edited TS/TSX files were parsed with the TypeScript compiler API and passed syntax validation. The source contains no compiler/judge mock fallback and no emoji icon code remains.

## Native backend handshake (0.3.1)

The desktop app now verifies the Rust backend with a real `ping_backend` Tauri command. The Figma Vite dev server is fixed to port 8443 and Tauri uses the same URL. If the UI says the backend connection failed, check the terminal running `npm run tauri dev`; the error shown there is the native startup error rather than a frontend mock/fallback.


## v0.3.3 — Tauri plugin initialization fix

- Removed invalid `plugins.dialog = {}` configuration that caused `PluginInitialization("dialog", "invalid type: map, expected unit")` on Tauri 2.
- Removed unused `tauri-plugin-fs` and `tauri-plugin-shell` Rust plugins; CodeFightIDE uses validated custom Rust commands for native filesystem/process work and only needs the dialog plugin for Open/Save dialogs.
- Dialog permissions remain in `src-tauri/capabilities/default.json`.

## 0.3.4 window / editor notes

The main window uses a custom undecorated Tauri title bar. Window controls are native Tauri calls, not frontend-only visual buttons. You can drag the title bar, resize from every edge/corner, minimize, maximize/restore and close.

Glass effects are available in Settings > Appearance. Acrylic works on Windows 10/11; Mica is intended for Windows 11. Set Glass effect to Off if a remote desktop/GPU driver does not render native materials correctly.

Monaco is bundled locally in 0.3.4. `Loading code editor` should no longer depend on access to the Monaco CDN.

Use the desktop runtime for native features:

```powershell
npm install
npm run tauri dev
```

Do not use `npm run dev` when validating native compiler, window controls, glass effects or file dialogs.

## v0.4.1 editor alignment / zoom

Code::Blocks mode uses native Consolas with literal operators and WebView zoom locked to 100%. Use `Ctrl++` / `Ctrl+-` to change Monaco font size and `Ctrl+0` to return to 14 px. Glass material transparency can be adjusted independently for Vibrancy, Acrylic, Mica and Blur; Editor transparency controls only the dark surface behind source code.
