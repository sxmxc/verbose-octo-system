import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const apiFetch = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())
const useToolkitsMock = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
  apiFetch,
}))

vi.mock('../../AuthContext', () => ({
  useAuth: () => ({
    user: { is_superuser: true },
    hasRole: (role: string) => role === 'toolkit.curator',
  }),
}))

vi.mock('../../ToolkitContext', () => ({
  useToolkits: useToolkitsMock,
}))

import AdminToolkitsPage from '../AdminToolkitsPage'
import AdminToolkitsCatalogPage from '../admin/toolkits/AdminToolkitsCatalogPage'
import AdminToolkitsOverviewPage from '../admin/toolkits/AdminToolkitsOverviewPage'
import AdminToolkitsUploadPage from '../admin/toolkits/AdminToolkitsUploadPage'
import AdminToolboxSettingsPage from '../admin/toolbox/AdminToolboxSettingsPage'
import AdminToolboxCatalogPage from '../admin/toolbox/AdminToolboxCatalogPage'
import AdminToolboxAuthPage from '../admin/toolbox/AdminToolboxAuthPage'

function renderAdminToolkits(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/toolkits/*" element={<AdminToolkitsPage />}>
          <Route index element={<AdminToolkitsOverviewPage />} />
          <Route path="community" element={<AdminToolkitsCatalogPage />} />
          <Route path="upload" element={<AdminToolkitsUploadPage />} />
        </Route>
        <Route path="/admin/settings/toolbox/*" element={<AdminToolboxSettingsPage />}>
          <Route index element={<AdminToolboxCatalogPage />} />
          <Route path="auth" element={<AdminToolboxAuthPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminToolkitsPage community catalog', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    refreshMock.mockReset()
    refreshMock.mockResolvedValue(undefined)
    useToolkitsMock.mockReset()
    useToolkitsMock.mockReturnValue({
      toolkits: [],
      updateLocal: vi.fn(),
      refresh: refreshMock,
      loading: false,
    })
  })

  test('renders catalog entries and installs toolkit bundles', async () => {
    apiFetch
      .mockResolvedValueOnce({
        catalog_url: 'https://raw.githubusercontent.com/sxmxc/ideal-octo-engine/main/catalog/toolkits.json',
        configured_url: null,
        toolkits: [
          {
            slug: 'demo',
            name: 'Demo Toolkit',
            description: 'Example catalog entry',
            bundle_url: 'https://example.com/demo.zip',
          },
        ],
      })
      .mockResolvedValueOnce({ slug: 'demo', name: 'Demo Toolkit', enabled: false })

    renderAdminToolkits('/admin/toolkits/community')

    await screen.findByText('Demo Toolkit')

    const installButton = screen.getByRole('button', { name: /install toolkit/i })
    await userEvent.click(installButton)

    expect(apiFetch).toHaveBeenCalledWith('/toolkits/community/install', expect.objectContaining({
      method: 'POST',
      body: { slug: 'demo' },
    }))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  test('disables install when bundle url is missing', async () => {
    apiFetch.mockResolvedValueOnce({
      catalog_url: null,
      configured_url: null,
      toolkits: [
        {
          slug: 'pending',
          name: 'Pending Toolkit',
          description: 'Waiting for bundle',
          bundle_url: null,
        },
      ],
    })

    renderAdminToolkits('/admin/toolkits/community')

    await screen.findByText('Pending Toolkit')

    const pendingButton = screen.getByRole('button', { name: /bundle pending/i }) as HTMLButtonElement
    expect(pendingButton.disabled).toBe(true)
  })

  test('allows administrators to override catalog url', async () => {
    apiFetch
      .mockResolvedValueOnce({
        effective_url: 'https://raw.githubusercontent.com/sxmxc/ideal-octo-engine/main/catalog/toolkits.json',
        configured_url: null,
      })
      .mockResolvedValueOnce({
        effective_url: 'https://example.com/custom.json',
        configured_url: 'https://example.com/custom.json',
      })

    renderAdminToolkits('/admin/settings/toolbox')

    await screen.findByDisplayValue('https://raw.githubusercontent.com/sxmxc/ideal-octo-engine/main/catalog/toolkits.json')

    const input = screen.getByLabelText('Community catalog URL')
    await userEvent.clear(input)
    await userEvent.type(input, 'https://example.com/custom.json')

    const saveButton = screen.getByRole('button', { name: /save settings/i })
    await userEvent.click(saveButton)

    expect(apiFetch).toHaveBeenCalledWith('/admin/toolbox/catalog', expect.objectContaining({
      method: 'POST',
      body: { url: 'https://example.com/custom.json' },
    }))

    await screen.findByText(/Catalog URL saved/i)
  })
})

describe('AdminToolkitsOverviewPage', () => {
  test('surfaces update badges and triggers update action', async () => {
    const updateLocalMock = vi.fn()
    useToolkitsMock.mockReturnValue({
      toolkits: [
        {
          slug: 'demo',
          name: 'Demo Toolkit',
          description: 'Example toolkit',
          base_path: '/toolkits/demo',
          highlights: [],
          enabled: true,
          category: 'toolkit',
          tags: [],
          origin: 'community',
          version: '1.0.0',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
      updateLocal: updateLocalMock,
      refresh: refreshMock,
      loading: false,
    })

    apiFetch
      .mockResolvedValueOnce({ overview: 'Docs' })
      .mockResolvedValueOnce([
        {
          slug: 'demo',
          origin: 'community',
          current_version: '1.0.0',
          available_version: '1.1.0',
          update_available: true,
        },
      ])
      .mockResolvedValueOnce({
        slug: 'demo',
        name: 'Demo Toolkit',
        description: 'Example toolkit',
        base_path: '/toolkits/demo',
        enabled: true,
        category: 'toolkit',
        tags: [],
        origin: 'community',
        version: '1.1.0',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      })
      .mockResolvedValueOnce([
        {
          slug: 'demo',
          origin: 'community',
          current_version: '1.1.0',
          available_version: '1.1.0',
          update_available: false,
        },
      ])

    renderAdminToolkits('/admin/toolkits')

    await screen.findByText('Update 1.1.0')

    const updateButton = screen.getByRole('button', { name: /update to 1.1.0/i })
    await userEvent.click(updateButton)

    expect(apiFetch).toHaveBeenCalledWith('/toolkits/demo/update', expect.objectContaining({ method: 'POST' }))

    await waitFor(() => expect(updateLocalMock).toHaveBeenCalledWith('demo', expect.any(Function)))
  })
})
