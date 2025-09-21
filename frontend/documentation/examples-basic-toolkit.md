# Example: Minimal Status Toolkit

This walkthrough creates a simple toolkit that exposes a read-only status page. Use it as a starting point for lightweight integrations.

## Directory Layout

```
status-toolkit/
├── backend/
│   └── routes.py
├── frontend/
│   └── index.tsx
├── worker/
│   └── tasks.py
└── toolkit.json
```

## Key Files

`toolkit.json`

```json
{
  "name": "Status",
  "slug": "status",
  "base_path": "/toolkits/status",
  "backend": { "module": "backend.routes", "router_attr": "router" },
  "frontend": { "source_entry": "frontend/index.tsx" }
}
```

`backend/routes.py`

```python
from fastapi import APIRouter

router = APIRouter(prefix="/status", tags=["status"])

@router.get("/health")
def get_health() -> dict[str, str]:
    return {"state": "ok"}
```

`frontend/index.tsx`

```tsx
import React, { useEffect, useState } from 'react'
import { apiFetch } from '../runtime'

export default function StatusToolkit() {
  const [state, setState] = useState('loading...')

  useEffect(() => {
    apiFetch<{ state: string }>('/toolkits/status/status/health')
      .then((payload) => setState(payload.state))
      .catch(() => setState('unreachable'))
  }, [])

  return (
    <div style={{ padding: '1rem', background: 'var(--color-surface)', borderRadius: 12 }}>
      <h3 style={{ margin: 0 }}>Service status</h3>
      <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-secondary)' }}>Current state: {state}</p>
    </div>
  )
}
```

## Deploying

1. Build the frontend bundle so `frontend/dist/index.js` exists (for example, run your bundler or `npm run build`).
2. Zip the directory.
3. Upload via **Administration → Toolkits**.
4. Enable the toolkit and browse to `/toolkits/status` to view the UI panel.

Extend the example by adding worker jobs that poll upstream systems or by styling the UI using the guidance in [Toolkit UI Guide](toolkit-ui).
