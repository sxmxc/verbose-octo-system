import React from 'react'
import { BrowserRouter } from 'react-router-dom'

import AppShell from './AppShell'
import { ThemeProvider } from './ThemeContext'
import { ToolkitProvider } from './ToolkitContext'


export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToolkitProvider>
          <AppShell />
        </ToolkitProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
