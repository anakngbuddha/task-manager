import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useSession } from './lib/auth-client'
import { isSystemAdmin } from './lib/roles'
import { TerminalProvider } from './contexts/TerminalContext'
import { OfflineBanner } from './components/ui/OfflineBanner'
import { PWAUpdatePrompt } from './components/ui/PWAUpdatePrompt'
import { OfflineToastProvider } from './components/ui/OfflineToast'
import CookieBanner from './components/ui/CookieBanner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteFallback } from './components/ui/RouteFallback'
import AuthLayout from './components/layout/AuthLayout'
import { useAnalytics } from './hooks/useAnalytics'
import { usePresenceTracking } from './hooks/usePresenceTracking'

// LandingPage is the public entry point at "/", so it stays eagerly imported.
// Deferring it behind a dynamic import would add a round trip in front of the
// first contentful paint for anonymous visitors, which is the opposite of the
// goal here. Everything else is code-split: a visitor on the login screen has
// no reason to download the dependency diagram, the calendar, the map stack,
// the chart stack or the entire admin area.
import LandingPage from './pages/LandingPage'

// ─── Public routes ──────────────────────────────────────────────
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const InvitePage = lazy(() => import('./pages/InvitePage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const DocumentationPage = lazy(() => import('./pages/DocumentationPage'))

// ─── Protected routes ───────────────────────────────────────────
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ArchivedProjectsPage = lazy(() => import('./pages/ArchivedProjectsPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))
const ProjectPage = lazy(() => import('./pages/ProjectPage'))
const ProjectMessagesPage = lazy(() => import('./pages/ProjectMessagesPage'))
const ProjectMembersPage = lazy(() => import('./pages/ProjectMembersPage'))
const ProjectSettingsPage = lazy(() => import('./pages/ProjectSettingsPage'))
const ProjectActivityPage = lazy(() => import('./pages/ProjectActivityPage'))
const ProjectGithubActivityPage = lazy(() => import('./pages/ProjectGithubActivityPage'))
const ProjectDependencyDiagramPage = lazy(() => import('./pages/ProjectDependencyDiagramPage'))
const ProjectFilesPage = lazy(() => import('./pages/ProjectFilesPage'))
const ProjectTimeReportPage = lazy(() => import('./pages/ProjectTimeReportPage'))
const ProjectSprintReportPage = lazy(() => import('./pages/ProjectSprintReportPage'))
const SprintBacklogPage = lazy(() => import('./pages/SprintBacklogPage'))
const RoadmapPage = lazy(() => import('./pages/RoadmapPage'))
const ProjectAutomationsPage = lazy(() => import('./pages/ProjectAutomationsPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const DayViewPage = lazy(() => import('./pages/DayViewPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const MembersPage = lazy(() => import('./pages/MembersPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

// ─── Admin routes ───────────────────────────────────────────────
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'))
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'))
const AdminIssuesPage = lazy(() => import('./pages/admin/AdminIssuesPage'))
const AdminKnowledgePage = lazy(() => import('./pages/admin/AdminKnowledgePage'))
const AdminDocumentationPage = lazy(() => import('./pages/admin/AdminDocumentationPage'))

// Overlays: not needed for first paint, and never needed by anonymous visitors.
const GlobalTerminal = lazy(() => import('./components/terminal/ProjectTerminal'))
const ChatWidget = lazy(() => import('./components/chat/ChatWidget'))

function AnalyticsWrapper() {
  useAnalytics()
  return null
}

function PresenceWrapper() {
  usePresenceTracking()
  return null
}

/**
 * Suspense boundary for public pages.
 */
function PublicLayout() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  )
}

/**
 * Authenticated shell.
 *
 * Previously every protected route rendered its own <ProtectedRoute> wrapper,
 * which meant TerminalProvider, GlobalTerminal and ChatWidget were torn down
 * and recreated on every navigation between protected routes (QA_REPORT M5).
 * Mounting them once around an <Outlet /> keeps that state alive.
 *
 * The Suspense boundary deliberately wraps only <Outlet />, so a lazy route
 * chunk loading in never unmounts the surrounding chrome.
 */
function ProtectedLayout() {
  const { data: session, isPending } = useSession()

  if (isPending) return <RouteFallback label="Loading your workspace" />
  if (!session) return <Navigate to="/login" replace />

  return (
    <TerminalProvider>
      <OfflineBanner />
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
      <Suspense fallback={null}>
        <GlobalTerminal />
        <ChatWidget />
      </Suspense>
    </TerminalProvider>
  )
}

/**
 * Admin shell. Same authentication check as ProtectedLayout, plus the system
 * role authorization check. Kept as a separate layout rather than a nested
 * route so the redirect target for an authenticated non-admin stays /dashboard.
 */
function AdminLayout() {
  const { data: session, isPending } = useSession()

  if (isPending) return <RouteFallback label="Checking permissions" />

  // Authentication check
  if (!session) return <Navigate to="/login" replace />

  // Authorization check
  if (!isSystemAdmin((session.user as { role?: string }).role)) return <Navigate to="/dashboard" replace />

  return (
    <TerminalProvider>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
      <Suspense fallback={null}>
        <GlobalTerminal />
      </Suspense>
    </TerminalProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <OfflineToastProvider>
        <BrowserRouter>
          <AnalyticsWrapper />
          <PresenceWrapper />
          <PWAUpdatePrompt />
          <CookieBanner />
          <Routes>
            {/* Public entry point, eagerly bundled. */}
            <Route path="/" element={<LandingPage />} />

            {/* Public, code-split. */}
            <Route element={<PublicLayout />}>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>
              <Route path="/invite/:code" element={<InvitePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/docs" element={<DocumentationPage />} />
            </Route>

            {/* Authenticated. */}
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects/archive" element={<ArchivedProjectsPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/projects/:id" element={<ProjectPage />} />
              <Route path="/projects/:id/messages" element={<ProjectMessagesPage />} />
              <Route path="/projects/:id/members" element={<ProjectMembersPage />} />
              <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
              <Route path="/projects/:id/activity" element={<ProjectActivityPage />} />
              <Route path="/projects/:id/github" element={<ProjectGithubActivityPage />} />
              <Route path="/projects/:id/dependencies" element={<ProjectDependencyDiagramPage />} />
              <Route path="/projects/:id/files" element={<ProjectFilesPage />} />
              <Route path="/projects/:id/time-report" element={<ProjectTimeReportPage />} />
              <Route path="/projects/:id/sprint-report" element={<ProjectSprintReportPage />} />
              <Route path="/projects/:id/backlog" element={<SprintBacklogPage />} />
              <Route path="/projects/:id/roadmap" element={<RoadmapPage />} />
              <Route path="/projects/:id/automations" element={<ProjectAutomationsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/calendar/day/:date" element={<DayViewPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* Admin. */}
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
              <Route path="/admin/issues" element={<AdminIssuesPage />} />
              <Route path="/admin/knowledge" element={<AdminKnowledgePage />} />
              <Route path="/admin/documentation" element={<AdminDocumentationPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </OfflineToastProvider>
    </ErrorBoundary>
  )
}
