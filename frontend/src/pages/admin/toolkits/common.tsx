import React from 'react'

export const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/sxmxc/ideal-octo-engine/main/catalog/toolkits.json'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="admin-toolkits__field">
      <span>{label}</span>
      {children}
    </label>
  )
}
