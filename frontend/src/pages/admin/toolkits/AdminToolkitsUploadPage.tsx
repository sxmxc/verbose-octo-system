import React, { useState } from 'react'

import { apiFetch } from '../../../api'
import { useAuth } from '../../../AuthContext'
import { MaterialIcon } from '../../../components/MaterialIcon'
import { useToolkits } from '../../../ToolkitContext'
import { Field } from './common'

export default function AdminToolkitsUploadPage() {
  const { refresh } = useToolkits()
  const { user } = useAuth()
  const [uploadSlug, setUploadSlug] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'notice'; text: string } | null>(null)
  const canInstall = user?.is_superuser ?? false

  if (!canInstall) {
    return (
      <p className="admin-toolkits__helper">
        Only superusers can upload new toolkit bundles. Ask an administrator to grant access or perform the upload on your behalf.
      </p>
    )
  }

  return (
    <div className="admin-toolkits__stack">
      {message && (
        <p className={message.type === 'error' ? 'admin-toolkits__error' : 'admin-toolkits__notice'} role="status">
          {message.text}
        </p>
      )}

      <section className="admin-toolkits__section">
        <h4 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MaterialIcon name="cloud_upload" style={{ color: 'var(--color-link)' }} />
          Install toolkit bundle (.zip)
        </h4>
        <p className="admin-toolkits__helper">
          Uploads store the bundle on the server and auto-register the toolkit if it does not already exist. Newly uploaded toolkits remain disabled
          until you review them.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (!uploadFile) {
              setMessage({ type: 'error', text: 'Choose a .zip bundle to upload' })
              return
            }
            setMessage(null)
            const body = new FormData()
            if (uploadSlug.trim()) {
              body.append('slug', uploadSlug.trim())
            }
            body.append('file', uploadFile)
            setUploading(true)
            try {
              await apiFetch<{ toolkit: unknown }>(`/toolkits/install`, {
                method: 'POST',
                body,
              })
              setUploadFile(null)
              setUploadSlug('')
              setMessage({ type: 'notice', text: 'Toolkit uploaded. Enable it from the overview page once validated.' })
              ;(event.target as HTMLFormElement).reset()
              await refresh()
            } catch (err) {
              setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) })
            } finally {
              setUploading(false)
            }
          }}
          className="admin-toolkits__form"
        >
          <Field label="Slug (optional)">
            <input value={uploadSlug} onChange={(event) => setUploadSlug(event.target.value)} placeholder="Leave blank to use bundle slug" />
          </Field>
          <Field label="Bundle (.zip)">
            <input
              type="file"
              accept=".zip"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <button type="submit" className="tk-button tk-button--primary" disabled={uploading}>
            <MaterialIcon
              name={uploading ? 'hourglass_top' : 'publish'}
              style={{ fontSize: '1.1rem', color: 'inherit' }}
            />
            {uploading ? 'Uploading…' : 'Upload toolkit'}
          </button>
        </form>
      </section>
    </div>
  )
}
