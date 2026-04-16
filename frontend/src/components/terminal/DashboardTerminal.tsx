/**
 * DashboardTerminal — now a thin re-export shim.
 *
 * The workspace-level terminal is handled by GlobalTerminal (mounted
 * once via TerminalProvider in App.tsx ProtectedRoute).
 * This component is kept for backward compat in DashboardPage and
 * simply renders nothing — GlobalTerminal is already active.
 */
export default function DashboardTerminal(_props: { userName?: string | null }) {
  // GlobalTerminal via TerminalProvider in App.tsx handles everything.
  return null
}
