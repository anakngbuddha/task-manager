import 'dotenv/config'
import { z } from 'zod'

/**
 * Validate process.env on boot. Importing this module either returns a typed
 * `env` object or aborts the process with a readable error listing every
 * missing/invalid variable. Audit finding #23.
 *
 * Intentionally lenient: any var the codebase currently calls .replace() or
 * uses with `||`-fallback is marked optional, so we don't break local dev that
 * runs without OAuth, email, or Cloudinary configured.
 */

const isProd = process.env.NODE_ENV === 'production'

// Run a single non-empty string validator we can re-use.
const nonEmpty = z.string().min(1, 'must not be empty')

// Secrets must be at least 32 chars to be considered random enough. In dev we
// allow shorter values so the existing local DB password keeps working — prod
// is strict.
const secret = isProd ? z.string().min(32) : z.string().min(8)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 3000))
    .pipe(z.number().int().positive().max(65535)),
  SLOW_REQUEST_MS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 1500))
    .pipe(z.number().int().nonnegative()),
  PRISMA_QUERY_LOG: z.string().optional(),

  // ── Required everywhere ────────────────────────────────────
  DATABASE_URL: nonEmpty,
  JWT_SECRET: secret,
  BETTER_AUTH_SECRET: secret,
  BETTER_AUTH_URL: z.string().url(),
  FRONTEND_URL: z.string().url().optional(),

  // ── Admin seed (Phase 1.2). Both required, or both omitted. ─
  ADMIN_SEED_EMAIL: z.string().email().optional().or(z.literal('')),
  ADMIN_SEED_PASSWORD: z.string().optional().or(z.literal('')),

  // ── OAuth providers ────────────────────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // ── GitHub App ─────────────────────────────────────────────
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_INSTALLATION_URL: z.string().url().optional(),

  // ── Email (Brevo) ──────────────────────────────────────────
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  // ── Cloudinary ─────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().optional(),

  // ── Gemini AI ──────────────────────────────────────────────
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_PROXY_URL: z.string().url().optional(),

  // ── AI Fallback Keys ────────────────────────────────────────────
  FALLBACK_GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),

  // ── Feature flags ──────────────────────────────────────────────
  FEATURE_AI_TESTER: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return true
      return v === 'true' || v === '1'
    }),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
  console.error('\n[env] Invalid environment configuration:\n' + issues + '\n')
  process.exit(1)
}

// Production-only sanity check that doesn't fit cleanly in the Zod schema.
if (isProd) {
  if (parsed.data.JWT_SECRET === 'your-super-secret-key') {
    console.error('[env] JWT_SECRET is set to the placeholder value. Refusing to start in production.')
    process.exit(1)
  }
  if (!parsed.data.BREVO_API_KEY) {
    console.warn('[env] BREVO_API_KEY is not set — outbound email will fail in production.')
  }
}

export const env = parsed.data
export type Env = typeof env
