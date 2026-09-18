export type { Language, Verdict, CompileResult, RunResult, TestCase, TestCaseResult, StressIteration } from './tauri-bridge'

export type PanelTab = 'tests' | 'output' | 'generator' | 'stress'
export type UIVerdict = import('./tauri-bridge').Verdict | 'running'

export interface UITestCase {
  id: string
  name: string
  input: string
  expected_output: string
  // Results after run
  verdict?: UIVerdict
  actual_output?: string
  stderr?: string
  execution_time_ms?: number
  memory_kb?: number
}
