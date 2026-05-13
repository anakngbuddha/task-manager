// Cloudflare Worker: Gemini API proxy
//
// Purpose: Bypass Gemini API regional blocks by routing requests through
// Cloudflare's global network. Render's region is blocked by Google, so the
// backend calls this worker, which forwards to Google.
//
// Deploy steps:
// 1. Go to https://dash.cloudflare.com → Workers & Pages → Create → Create Worker
// 2. Name it "gemini-proxy" (or anything you like) and click Deploy with the
//    default starter, then click "Edit code".
// 3. Replace all the code with the contents of this file and click "Save and Deploy".
// 4. Copy the worker URL (e.g. https://gemini-proxy.<your-subdomain>.workers.dev).
// 5. On Render, add an env var on `taskmanager-api`:
//      GEMINI_PROXY_URL = https://gemini-proxy.<your-subdomain>.workers.dev
//    (no trailing slash)
// 6. Render will auto-redeploy. The Diagnose button will then work.

const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const targetUrl = GEMINI_ORIGIN + url.pathname + url.search

    const init = {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    }

    const upstream = await fetch(targetUrl, init)

    const respHeaders = new Headers(upstream.headers)
    respHeaders.set('Access-Control-Allow-Origin', '*')
    respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    respHeaders.set('Access-Control-Allow-Headers', '*')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: respHeaders })
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    })
  },
}
