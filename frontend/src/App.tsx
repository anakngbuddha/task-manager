import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSession } from './lib/auth-client'
import { TerminalProvider } from './contexts/TerminalContext'
import GlobalTerminal from './components/terminal/ProjectTerminal'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AuthLayout from './components/layout/AuthLayout'
import DashboardPage from './pages/DashboardPage'
import ArchivedProjectsPage from './pages/ArchivedProjectsPage'
import ProjectPage from './pages/ProjectPage'
import ProjectMessagesPage from './pages/ProjectMessagesPage'
import ProjectTimeReportPage from './pages/ProjectTimeReportPage'
import ProjectSprintReportPage from './pages/ProjectSprintReportPage'
import SprintBacklogPage from './pages/SprintBacklogPage'
import RoadmapPage from './pages/RoadmapPage'
import CalendarPage from './pages/CalendarPage'
import DayViewPage from './pages/DayViewPage'
import ActivityPage from './pages/ActivityPage'
import SettingsPage from './pages/SettingsPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import MembersPage from './pages/MembersPage'
import InvitePage from './pages/InvitePage'
import ProjectMembersPage from './pages/ProjectMembersPage'
import ProfilePage from './pages/ProfilePage'
import ProjectSettingsPage from './pages/ProjectSettingsPage'
import ProjectActivityPage from './pages/ProjectActivityPage'
import ProjectGithubActivityPage from './pages/ProjectGithubActivityPage'
import ProjectDependencyDiagramPage from './pages/ProjectDependencyDiagramPage'
import ProjectFilesPage from './pages/ProjectFilesPage'
import DocumentationPage from './pages/DocumentationPage'
import LandingPage from './pages/LandingPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage'
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminIssuesPage from './pages/admin/AdminIssuesPage'
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage'
import ProjectAutomationsPage from './pages/ProjectAutomationsPage'
import { OfflineBanner } from './components/ui/OfflineBanner'
import { PWAUpdatePrompt } from './components/ui/PWAUpdatePrompt'
import { OfflineToastProvider } from './components/ui/OfflineToast'
import PrivacyPage from './pages/PrivacyPage'
import CookieBanner from './components/ui/CookieBanner'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()

  if (isPending) return (
    <div className="flex h-dvh items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )

  if (!session) return <Navigate to="/login" replace />

  return (
    <TerminalProvider>
      <OfflineBanner />
      {children}
      <GlobalTerminal />
    </TerminalProvider>
  )
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()

  if (isPending) return (
    <div className="flex h-dvh items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )

  // Authentication check
  if (!session) return <Navigate to="/login" replace />

  // Authorization check
  if ((session.user as any).role !== 'admin') return <Navigate to="/dashboard" replace />

  return (
    <TerminalProvider>
      {children}
      <GlobalTerminal />
    </TerminalProvider>
  )
}

import { useAnalytics } from './hooks/useAnalytics'
import { usePresenceTracking } from './hooks/usePresenceTracking'

function AnalyticsWrapper() {
  useAnalytics()
  return null
}

function PresenceWrapper() {
  usePresenceTracking()
  return null
}

export default function App() {
  return (
    <OfflineToastProvider>
    <BrowserRouter>
      <AnalyticsWrapper />
      <PresenceWrapper />
      <PWAUpdatePrompt />
      <CookieBanner />
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/archive" element={
          <ProtectedRoute>
            <ArchivedProjectsPage />
          </ProtectedRoute>
        } />
        <Route path="/activity" element={
          <ProtectedRoute>
            <ActivityPage />
          </ProtectedRoute>
        } />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/docs" element={<DocumentationPage />} />
        <Route path="/projects/:id" element={
          <ProtectedRoute>
            <ProjectPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/messages" element={
          <ProtectedRoute>
            <ProjectMessagesPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/members" element={
          <ProtectedRoute>
            <ProjectMembersPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/settings" element={
          <ProtectedRoute>
            <ProjectSettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/activity" element={
          <ProtectedRoute>
            <ProjectActivityPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/github" element={
          <ProtectedRoute>
            <ProjectGithubActivityPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/dependencies" element={
          <ProtectedRoute>
            <ProjectDependencyDiagramPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/files" element={
          <ProtectedRoute>
            <ProjectFilesPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/time-report" element={
          <ProtectedRoute>
            <ProjectTimeReportPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/sprint-report" element={
          <ProtectedRoute>
            <ProjectSprintReportPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/backlog" element={
          <ProtectedRoute>
            <SprintBacklogPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/roadmap" element={
          <ProtectedRoute>
            <RoadmapPage />
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/automations" element={
          <ProtectedRoute>
            <ProjectAutomationsPage />
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        } />
        <Route path="/calendar/day/:date" element={
          <ProtectedRoute>
            <DayViewPage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/change-password" element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        } />
        <Route path="/members" element={
          <ProtectedRoute>
            <MembersPage />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="/admin/dashboard" element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        } />
        <Route path="/admin/analytics" element={
          <AdminRoute>
            <AdminAnalyticsPage />
          </AdminRoute>
        } />
        <Route path="/admin/audit-logs" element={
          <AdminRoute>
            <AdminAuditLogsPage />
          </AdminRoute>
        } />
        <Route path="/admin/users" element={
          <AdminRoute>
            <AdminUsersPage />
          </AdminRoute>
        } />
        <Route path="/admin/users/:id" element={
          <AdminRoute>
            <AdminUserDetailPage />
          </AdminRoute>
        } />
        <Route path="/admin/issues" element={
          <AdminRoute>
            <AdminIssuesPage />
          </AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </OfflineToastProvider>
  )
}