import { api } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import type { CommandHandler, CommandResult } from '../commandTypes'
import type { VirtualFileSystem } from '../VirtualFileSystem'

export function createProfileWriteHandlers(
  vfs: VirtualFileSystem,
  navigate?: (path: string) => void
): Record<string, CommandHandler> {
  return {
    'passwd': async (parsed): Promise<CommandResult> => {
      const currentPassword = parsed.args[0]
      const newPassword = parsed.args[1]

      if (!currentPassword || !newPassword) {
        return { 
          lines: [
            { type: 'stderr', content: 'passwd: missing arguments.' },
            { type: 'system', content: '  Usage: passwd <currentPassword> <newPassword>' }
          ] 
        }
      }

      if (newPassword.length < 8) {
        return { lines: [{ type: 'stderr', content: 'passwd: new password must be at least 8 characters long.' }] }
      }

      try {
        const res = await authClient.changePassword({
          newPassword,
          currentPassword,
          revokeOtherSessions: true,
        })

        if (res?.error) {
          return { lines: [{ type: 'stderr', content: `passwd: ${res.error.message || 'failed to change password'}` }] }
        }

        return { lines: [{ type: 'success', content: '✓ Password changed successfully.' }] }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `passwd: ${err?.message || 'failed to change password'}` }] }
      }
    },

    'mkdir-profile-file': async (parsed): Promise<CommandResult> => {
      const pathArg = parsed.args[0]
      if (!pathArg) return { lines: [{ type: 'stderr', content: 'mkdir: missing folder name' }] }

      const resolved = vfs.resolve(pathArg)
      if (!resolved.startsWith('/profile/files/')) {
        return { lines: [{ type: 'stderr', content: 'mkdir: unsupported profile path' }] }
      }

      const folderName = resolved.split('/').pop()
      if (!folderName) return { lines: [{ type: 'stderr', content: 'mkdir: invalid folder name' }] }

      try {
        await api.post('/files/folder', { name: folderName })
        return { lines: [{ type: 'success', content: `✓ Created folder: ${folderName}` }] }
      } catch (err: any) {
        return { lines: [{ type: 'stderr', content: `mkdir: ${err?.response?.data?.error ?? err.message}` }] }
      }
    },

    // BUG-09 fix: promise now handles cancel via both the 'cancel' event and
    // a window 'focus' fallback so the terminal never freezes if the user
    // dismisses the system file picker without selecting a file.
    'upload-file': async (parsed): Promise<CommandResult> => {
      const pathArg = parsed.args[0] ?? ''
      const resolved = vfs.resolve(pathArg)

      return new Promise<CommandResult>((resolve) => {
        let settled = false
        const resolveOnce = (result: CommandResult) => {
          if (!settled) {
            settled = true
            resolve(result)
          }
        }

        const input = document.createElement('input')
        input.type = 'file'

        // Primary cancel path: browsers that support the 'cancel' event
        input.addEventListener('cancel', () => {
          resolveOnce({ lines: [{ type: 'system', content: 'upload: cancelled.' }] })
        })

        // Fallback cancel path: after the picker closes, the window regains
        // focus. We wait 300ms to allow onchange to fire first (if a file was
        // selected), then resolve as cancelled if nothing happened.
        const onWindowFocus = () => {
          setTimeout(() => {
            resolveOnce({ lines: [{ type: 'system', content: 'upload: cancelled.' }] })
          }, 300)
        }
        window.addEventListener('focus', onWindowFocus, { once: true })

        input.onchange = async (e) => {
          // File was selected — remove the focus fallback
          window.removeEventListener('focus', onWindowFocus)

          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) {
            return resolveOnce({ lines: [{ type: 'system', content: 'upload: no file selected.' }] })
          }

          try {
            const formData = new FormData()
            formData.append('file', file)

            // BUG-02 fix: read vfs.projectId at call time
            let targetProjectId = vfs.projectId

            // If at workspace root but explicitly asked to upload to a specific project path
            if (targetProjectId === '__workspace__' && resolved.startsWith('/projects/') && resolved.split('/').length > 2) {
              const slug = resolved.split('/')[2].toLowerCase()
              try {
                const { data } = await api.get('/projects')
                const matched = (data ?? []).find((p: any) =>
                  p.name.toLowerCase().includes(slug) || String(p.id).startsWith(slug)
                )
                if (matched) targetProjectId = matched.id
                else return resolveOnce({ lines: [{ type: 'stderr', content: `upload: project "${slug}" not found.` }] })
              } catch {
                // ignore, fall through to default behavior
              }
            }

            // Append project ID if we are routing to a project workspace
            if (targetProjectId && targetProjectId !== '__workspace__') {
              formData.append('projectId', targetProjectId)
            }
            await api.post('/files/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
            resolveOnce({ lines: [{ type: 'success', content: `✓ Uploaded ${file.name}` }] })
          } catch (err: any) {
            resolveOnce({ lines: [{ type: 'stderr', content: `upload: ${err?.response?.data?.error ?? err.message}` }] })
          }
        }

        input.click()
      })
    },

    'open-route': async (parsed): Promise<CommandResult> => {
      const target = parsed.args[0]
      if (!target) return { lines: [{ type: 'stderr', content: 'open: missing destination' }] }

      const routes: Record<string, string> = {
        'profile': '/profile',
        'profile/settings': '/settings',
        'change-password': '/change-password',
        'activity': '/activity'
      }

      const route = routes[target] ?? routes[target.replace(/^\//, '')]
      if (!route) {
        return { lines: [{ type: 'stderr', content: `open: unknown destination '${target}'. Valid: profile, profile/settings, change-password, activity.` }] }
      }

      // BUG-10 fix: use SPA navigate when available to avoid full page reload.
      // Falls back to window.location.assign for non-React environments.
      if (navigate) {
        navigate(route)
      } else {
        window.location.assign(route)
      }
      return { lines: [{ type: 'system', content: `Opening ${target}...` }] }
    }
  }
}
