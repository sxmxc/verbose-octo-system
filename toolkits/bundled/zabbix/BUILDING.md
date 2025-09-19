# Building the Zabbix Toolkit

1. Ensure the frontend bundle exists at `frontend/dist/index.js`.
   - Build from `frontend/index.tsx` with your preferred tooling. Keep `react`, `react-dom`, and `react-router-dom` external so the Toolbox shell provides them at runtime.
2. Run the packaging helper to create the release archive:

```bash
python ../../scripts/package_toolkit.py .
```

3. Upload the generated `zabbix_toolkit.zip` via **Administration → Toolkits** or the `/toolkits/install` API.
