import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const apiFetch = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())

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
  useToolkits: () => ({
    toolkits: [],
    updateLocal: vi.fn(),
    refresh: refreshMock,
    loading: false,
  }),
}))

import AdminToolkitsPage from '../AdminToolkitsPage'

describe('AdminToolkitsPage community catalog', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    refreshMock.mockReset()
    refreshMock.mockResolvedValue(undefined)
  })

  test('renders catalog entries and installs toolkit bundles', async () => {
    apiFetch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        catalog_url: 'https://raw.githubusercontent.com/sxmxc/ideal-octo-engine/main/catalog/toolkits.json',
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

    render(<AdminToolkitsPage />)

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
    apiFetch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        catalog_url: null,
        toolkits: [
          {
            slug: 'pending',
            name: 'Pending Toolkit',
            description: 'Waiting for bundle',
            bundle_url: null,
          },
        ],
      })

    render(<AdminToolkitsPage />)

    await screen.findByText('Pending Toolkit')

    const pendingButton = screen.getByRole('button', { name: /bundle pending/i }) as HTMLButtonElement
    expect(pendingButton.disabled).toBe(true)
  })

  test('allows administrators to override catalog url', async () => {
    apiFetch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ catalog_url: null, toolkits: [] })
      .mockResolvedValueOnce({
        catalog_url: 'https://example.com/custom.json',
        toolkits: [
          { slug: 'custom', name: 'Custom Toolkit', description: 'From custom catalog', bundle_url: null },
        ],
      })

    render(<AdminToolkitsPage />)

    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /refresh catalog/i }) as HTMLButtonElement
      expect(refreshButton.disabled).toBe(false)
    })

    const input = screen.getByLabelText('Catalog URL')
    await userEvent.clear(input)
    await userEvent.type(input, 'https://example.com/custom.json')

    const saveButton = screen.getByRole('button', { name: /save catalog url/i })
    await userEvent.click(saveButton)

    expect(apiFetch).toHaveBeenCalledWith('/toolkits/community/catalog', expect.objectContaining({
      method: 'POST',
      body: { url: 'https://example.com/custom.json' },
    }))

    await screen.findByText('Custom Toolkit')
  })
})
