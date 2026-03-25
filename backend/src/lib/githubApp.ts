import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const APP_ID = process.env.GITHUB_APP_ID
const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n')
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET

function requireGithubConfig() {
  if (!APP_ID || !PRIVATE_KEY || !WEBHOOK_SECRET) {
    throw new Error('GitHub App environment variables (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET) are not set')
  }
  return { appId: APP_ID, privateKey: PRIVATE_KEY, webhookSecret: WEBHOOK_SECRET }
}

/**
 * Create a short-lived JWT to authenticate as the GitHub App itself.
 */
function createAppJwt(): string {
  const { appId, privateKey } = requireGithubConfig()
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      iat: now - 60,
      exp: now + 10 * 60,
      iss: appId,
    },
    privateKey,
    { algorithm: 'RS256' },
  )
}

/**
 * Exchange the app-level JWT for a short-lived installation access token.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const appJwt = createAppJwt()
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub token exchange failed (${res.status}): ${text}`)
  }
  const data = (await res.json()) as { token: string }
  return data.token
}

/**
 * Verify the X-Hub-Signature-256 header from a GitHub webhook.
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
): boolean {
  const { webhookSecret } = requireGithubConfig()
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    )
  } catch {
    return false
  }
}
