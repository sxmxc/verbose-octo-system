import React, { useEffect, useState } from 'react'

import { apiFetch } from '../../../api'
import { MaterialIcon } from '../../../components/MaterialIcon'
import { DEFAULT_CATALOG_URL, Field } from '../toolkits/common'

type CatalogSettingsResponse = {
  effective_url: string | null
  configured_url: string | null
}

export default function AdminToolboxCatalogPage() {
  const [effectiveUrl, setEffectiveUrl] = useState(DEFAULT_CATALOG_URL)
  const [configuredUrl, setConfiguredUrl] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'notice'; text: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const response = await apiFetch<CatalogSettingsResponse>('/admin/toolbox/catalog')
        const effective = response.effective_url ?? DEFAULT_CATALOG_URL
        const configured = response.configured_url ?? ''
        setEffectiveUrl(effective)
        setConfiguredUrl(configured)
        setDraftUrl(configured || effective)
      } catch (err) {
        setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) })
      }
    })()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const trimmed = draftUrl.trim()
      const response = await apiFetch<CatalogSettingsResponse>('/admin/toolbox/catalog', {
        method: 'POST',
        body: { url: trimmed ? trimmed : null },
      })
      const effective = response.effective_url ?? DEFAULT_CATALOG_URL
      const configured = response.configured_url ?? ''
      setEffectiveUrl(effective)
      setConfiguredUrl(configured)
      setDraftUrl(configured || effective)
      setMessage({ type: 'notice', text: trimmed ? 'Catalog URL saved.' : 'Catalog URL reset to platform default.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-toolkits__stack">
      <section className="admin-toolkits__section">
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MaterialIcon name="public" style={{ color: 'var(--color-link)' }} />
          Community catalog settings
        </h4>
        <p className="admin-toolkits__helper">
          Control which manifest the Toolbox uses for community toolkit discovery and installation.
        </p>
        <div className="admin-toolkits__docs">
          <p>Effective catalog URL: {effectiveUrl}</p>
          {configuredUrl && <p>Configured override: {configuredUrl}</p>}
        </div>
        {message && (
          <p className={message.type === 'error' ? 'admin-toolkits__error' : 'admin-toolkits__notice'} role="status">
            {message.text}
          </p>
        )}
        <form onSubmit={handleSubmit} className="admin-toolkits__community-form">
          <Field label="Community catalog URL">
            <input
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              placeholder={DEFAULT_CATALOG_URL}
            />
          </Field>
          <div className="admin-toolkits__community-buttons">
            <button
              type="button"
              className="tk-button tk-button--subtle"
              onClick={() => setDraftUrl(configuredUrl || effectiveUrl)}
              disabled={saving || draftUrl === (configuredUrl || effectiveUrl)}
            >
              Reset draft
            </button>
            <button type="submit" className="tk-button tk-button--primary" disabled={saving}>
              <MaterialIcon
                name={saving ? 'hourglass_top' : 'save'}
                style={{ fontSize: '1.1rem', color: 'inherit' }}
              />
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
