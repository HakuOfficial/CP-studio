import { invoke as tauriInvoke, isTauri as tauriIsTauri } from '@tauri-apps/api/core'

export type Language = 'cpp' | 'python' | 'java'
export type Verdict = 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE'
export type CompareMode = 'exact' | 'trim' | 'tokens'

export interface CompilerDiagnostic { file: string; line: number; column: number; message: string }
export interface CompileOptions {
  compiler_path?: string | null
  cpp_standard?: 'gnu++17' | 'gnu++20' | 'gnu++23' | string
  optimization?: string
  extra_flags?: string[]
}
export interface CompileResult {
  success: boolean
  exit_code: number
  stdout: string
  stderr: string
  compile_time_ms: number
  binary_path: string
  diagnostics: CompilerDiagnostic[]
}
export interface RunResult {
  verdict: Verdict
  stdout: string
  stderr: string
  execution_time_ms: number
  memory_kb: number
  exit_code: number
}
export interface TestCase { id: string; name: string; input: string; expected_output: string }
export interface TestCaseResult { id: string; verdict: Verdict; actual_output: string; stderr: string; execution_time_ms: number; memory_kb: number }
export interface StressIteration { index: number; seed: number; input: string; solution_output: string; brute_output: string; verdict: Verdict; time_ms: number; memory_kb: number }
export interface CompilerInfo { name: string; path: string; version: string }
export interface BackendStatus { ready: boolean; app: string; version: string; platform: string }

export function isTauri(): boolean {
  return tauriIsTauri()
}

export function nativeBackendError(): Error {
  return new Error('CP Studio native backend is unavailable. Start the desktop app with `npm run tauri dev` (or use the built .exe). Vite/browser preview cannot compile or run programs.')
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args)
  } catch (error) {
    // Do not fake native commands in browser preview. The official Tauri runtime
    // check is only used to improve the error message; invoke() is the source
    // of truth for whether the Rust backend is actually reachable.
    if (!tauriIsTauri()) throw nativeBackendError()
    throw error
  }
}

export function pingBackend():Promise<BackendStatus>{return invoke('ping_backend')}
export function compileCode(sourceCode:string, language:Language, outputDir:string, options?:CompileOptions):Promise<CompileResult>{return invoke('compile_code',{sourceCode,language,outputDir,options})}
export function runTestcase(binaryPath:string,language:Language,input:string,expectedOutput:string,timeLimitMs:number,memoryLimitMb:number,compareMode:CompareMode='trim'):Promise<RunResult>{return invoke('run_testcase',{binaryPath,language,input,expectedOutput,timeLimitMs,memoryLimitMb,compareMode})}
export function runAllTestcases(binaryPath:string,language:Language,testcases:TestCase[],timeLimitMs:number,memoryLimitMb:number,compareMode:CompareMode='trim'):Promise<TestCaseResult[]>{return invoke('run_all_testcases',{binaryPath,language,testcases,timeLimitMs,memoryLimitMb,compareMode})}
export function compileGenerator(generatorCode:string,outputDir:string,options?:CompileOptions):Promise<CompileResult>{return invoke('compile_generator',{generatorCode,outputDir,options})}
export function compileBrute(bruteCode:string,outputDir:string,options?:CompileOptions):Promise<CompileResult>{return invoke('compile_brute',{bruteCode,outputDir,options})}
export function generateInput(generatorBinary:string,seed:number):Promise<string>{return invoke('generate_input',{generatorBinary,seed})}
export function runStressTest(solutionBinary:string,bruteBinary:string,generatorBinary:string,iterations:number,timeLimitMs:number,memoryLimitMb:number,startSeed:number,compareMode:CompareMode='trim'):Promise<StressIteration[]>{return invoke('run_stress_test',{solutionBinary,bruteBinary,generatorBinary,iterations,timeLimitMs,memoryLimitMb,startSeed,compareMode})}
export function saveFile(path:string,content:string):Promise<void>{return invoke('save_file',{path,content})}
export function readFile(path:string):Promise<string>{return invoke('read_file',{path})}
export function getTempDir():Promise<string>{return invoke('get_temp_dir')}
export function detectCompilers():Promise<CompilerInfo[]>{return invoke('detect_compilers')}
export function stopProcesses():Promise<void>{return invoke('stop_processes')}

export async function openFileDialog(): Promise<{path:string;content:string}|null> {
  if (!tauriIsTauri()) throw nativeBackendError()
  const { open } = await import('@tauri-apps/plugin-dialog')
  const path = await open({ multiple:false, directory:false, filters:[{name:'Source',extensions:['cpp','cc','cxx','h','hpp','py','java','txt']}] })
  if (!path || Array.isArray(path)) return null
  return { path, content: await readFile(path) }
}


export async function selectCompilerDialog(): Promise<string | null> {
  if (!tauriIsTauri()) throw nativeBackendError()
  const { open } = await import('@tauri-apps/plugin-dialog')
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Compiler', extensions: ['exe'] }],
  })
  return typeof path === 'string' ? path : null
}

export async function saveFileDialog(content:string, defaultName:string, existingPath?:string|null):Promise<string|null>{
  if (!tauriIsTauri()) throw nativeBackendError()
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = existingPath || await save({defaultPath:defaultName,filters:[{name:'Source',extensions:['cpp','cc','cxx','py','java','txt']}]})
  if(!path)return null
  await saveFile(path,content)
  return path
}
