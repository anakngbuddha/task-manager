import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSession } from './lib/auth-client'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProjectPage from './pages/ProjectPage'
import ProjectMessagesPage from './pages/ProjectMessagesPage'
import ActivityPage from './pages/ActivityPage'
import SettingsPage from './pages/SettingsPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import MembersPage from './pages/MembersPage'
import InvitePage from './pages/InvitePage'
import ProjectMembersPage from './pages/ProjectMembersPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()

  if (isPending) return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )

  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/activity" element={
          <ProtectedRoute>
            <ActivityPage />
          </ProtectedRoute>
        } />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}