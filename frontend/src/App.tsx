import React from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import AppShell from './AppShell'
import { AuthProvider, useAuth } from './AuthContext'
import { Skeleton } from './components/Skeleton'
import { ThemeProvider } from './ThemeContext'
import { ToolkitProvider } from './ToolkitContext'
import LoginPage from './pages/LoginPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ display: 'grid', gap: '1rem', width: 'min(420px, 80vw)' }}>
          <Skeleton height="2rem" />
          <Skeleton height="1rem" width="80%" />
          <Skeleton height="1rem" width="65%" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <ToolkitProvider>
                    <AppShell />
                  </ToolkitProvider>
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
