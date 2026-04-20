/**
 * GitHub commands: github status, github link, github setmap
 *
 * Backend auth:
 *   GET  /github/installation              → authenticated user (own account)
 *   POST /github/connect                   → authenticated user (own account)
 *   PATCH /projects/:id (githubStatusMap)  → MASTER_ADMIN, PROJECT_MANAGER
 */
import { api } from '@/lib/api'
import { assertVFSRole, authDeniedLines } from '../vfsAuth'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'

const ADMIN_OR_PM = ['MASTER_ADMIN', 'PROJECT_MANAGER'] as const
const ANY_MEMBER = ['MASTER_ADMIN', 'PROJECT_MANAGER', 'MEMBER'] as const

// The GitHub App installation URL
const GH_INSTALL_URL = 'https://github.com/apps/wsi-taska/installations/new'

export function createGithubHandlers(
  vfs: VirtualFileSystem
): Record<string, CommandHandler> {
  return {
    // ── github ────────────────────────────────────────────────────────────────
    // Dispatcher: parses the first arg as a sub-command
    github: async (parsed, context): Promise<CommandResult> => {
      const sub = parsed.args[0]?.toLowerCase()

      switch (sub) {
        case 'status':
          return execGithubStatus(vfs.projectId, context)

        case 'link':
          return execGithubLink()

        case 'setmap':
          return execGithubSetmap(vfs.projectId, parsed, context)

        default:
          return {
            lines: [
              { type: 'stderr', content: `github: unknown subcommand "${sub ?? ''}"` },
              { type: 'empty', content: '' },
              { type: 'system', content: 'Available:' },
              { type: 'stdout', content: '  github status           — show connection status' },
              { type: 'stdout', content: '  github link             — show GitHub App install URL' },
              { type: 'stdout', content: '  github setmap           — update PR→status mapping' },
              { type: 'stdout', content: '    Flags: --pr_merged=DONE --pr_opened=IN_REVIEW' },
              { type: 'stdout', content: '            --pr_closed=TODO --pr_review_approved=IN_REVIEW' },
            ],
          }
      }
    },
  }
}

async function execGithubStatus(
  projectId: string,
  context: Parameters<CommandHandler>[1]
): Promise<CommandResult> {
  try {
    assertVFSRole(context.userRole, [...ANY_MEMBER], 'github status')
  } catch {
    return { lines: authDeniedLines(context.userRole, [...ANY_MEMBER], 'github status') }
  }

  try {
    const [instRes, projectGhRes] = await Promise.allSettled([
      api.get('/github/installation'),
      api.get(`/projects/${projectId}/github`),
    ])

    const installation = instRes.status === 'fulfilled' ? instRes.value.data : null
    const projectGh = projectGhRes.status === 'fulfilled' ? projectGhRes.value.data : null

    const lines: Array<{ type: any; content: string }> = []

    if (installation) {
      lines.push({ type: 'success', content: '✓ GitHub App: Connected' })
      lines.push({ type: 'system', content: `  Installation ID: ${installation.installationId}` })
    } else {
      lines.push({ type: 'stderr', content: '✗ GitHub App: Not connected to your account' })
      lines.push({ type: 'system', content: `  Run "github link" to get the installation URL.` })
    }

    if (projectGh?.connected) {
      lines.push({ type: 'success', content: `✓ Project: ${projectGh.assignedRepoCount} repo(s) linked` })
    } else {
      lines.push({ type: 'system', content: '  Project: No repos assigned. Go to Settings → GitHub.' })
    }

    return { lines }
  } catch (err: any) {
    return { lines: [{ type: 'stderr', content: `github status: ${err?.response?.data?.error ?? err.message}` }] }
  }
}

async function execGithubLink(): Promise<CommandResult> {
  return {
    lines: [
      { type: 'system', content: 'To link your GitHub account:' },
      { type: 'empty', content: '' },
      { type: 'stdout', content: `  1. Open this URL in your browser:` },
      { type: 'stdout', content: `     ${GH_INSTALL_URL}` },
      { type: 'empty', content: '' },
      { type: 'stdout', content: '  2. Install the GitHub App on your account or organization.' },
      { type: 'stdout', content: '  3. You will be redirected back to your Profile page.' },
      { type: 'stdout', content: '  4. Copy the installation_id from the URL and paste it in Profile → GitHub.' },
      { type: 'empty', content: '' },
      { type: 'system', content: '  Or go directly to: /profile → GitHub section.' },
    ],
  }
}

async function execGithubSetmap(
  projectId: string,
  parsed: Parameters<CommandHandler>[0],
  context: Parameters<CommandHandler>[1]
): Promise<CommandResult> {
  try {
    assertVFSRole(context.userRole, [...ADMIN_OR_PM], 'github setmap')
  } catch {
    return { lines: authDeniedLines(context.userRole, [...ADMIN_OR_PM], 'github setmap') }
  }

  const VALID_KEYS = ['pr_merged', 'pr_opened', 'pr_closed', 'pr_review_approved']
  const statusMap: Record<string, string | null> = {}

  for (const key of VALID_KEYS) {
    if (parsed.flags[key] !== undefined) {
      const val = parsed.flags[key]
      statusMap[key] = val === 'null' || val === 'none' || val === ''
        ? null
        : String(val).toUpperCase()
    }
  }

  if (Object.keys(statusMap).length === 0) {
    return {
      lines: [
        { type: 'stderr', content: 'github setmap: no mapping flags provided.' },
        { type: 'empty', content: '' },
        { type: 'system', content: 'Usage: github setmap --pr_merged=DONE --pr_opened=IN_REVIEW' },
        { type: 'system', content: '  Keys: pr_merged, pr_opened, pr_closed, pr_review_approved' },
        { type: 'system', content: '  Use null or none to disable a mapping.' },
      ],
    }
  }

  try {
    await api.patch(`/projects/${projectId}`, { githubStatusMap: statusMap })
    const lines = [
      { type: 'success' as const, content: '✓ GitHub status mapping updated:' },
      ...Object.entries(statusMap).map(([k, v]) => ({
        type: 'system' as const,
        content: `  ${k} → ${v ?? '(disabled)'}`,
      })),
    ]
    return { lines }
  } catch (err: any) {
    return { lines: [{ type: 'stderr', content: `github setmap: ${err?.response?.data?.error ?? err.message}` }] }
  }
}
