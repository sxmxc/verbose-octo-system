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
  "backend_entry": "backend/routes.py",
  "frontend_source_entry": "frontend/index.tsx"
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
import React from 'react'
import { useEffect, useState } from 'react'

export default function StatusToolkit() {
  const [state, setState] = useState('loading…')

  useEffect(() => {
    fetch('/toolkits/status/status/health')
      .then((response) => response.json())
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

1. Zip the directory.
2. Upload via **Administration → Toolkits**.
3. Enable the toolkit and browse to `/toolkits/status` to view the UI panel.

Extend the example by adding worker jobs that poll upstream systems or by styling the UI using the guidance in [Toolkit UI Guide](toolkit-ui).
