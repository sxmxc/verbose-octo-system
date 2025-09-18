import React from 'react'
import { BrowserRouter } from 'react-router-dom'

import AppShell from './AppShell'
import { ToolkitProvider } from './ToolkitContext'


export default function App() {
  return (
    <BrowserRouter>
      <ToolkitProvider>
        <AppShell />
      </ToolkitProvider>
    </BrowserRouter>
  )
}
