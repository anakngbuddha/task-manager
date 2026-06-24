import { env } from './env.js'

/** Whether AI Tester role and knowledge slash-commands are enabled. */
export function isAiTesterFeatureEnabled(): boolean {
  return env.FEATURE_AI_TESTER
}
