# Building the Zabbix Toolkit

1. Ensure the frontend bundle exists at `frontend/dist/index.js`.
   - Build from `frontend/index.tsx` with your preferred tooling. Keep `react`, `react-dom`, and `react-router-dom` external so the Toolbox shell provides them at runtime.
2. Commit the refreshed bundle, merge into `main`, and allow the Release workflow to create the archive.
3. Download the `toolkit-zabbix` artifact (containing `zabbix_toolkit.zip`) from the workflow run or via `gh run download --repo <org>/<repo> --name toolkit-zabbix`.
4. Upload the downloaded archive via **Administration → Toolkits** or the `/toolkits/install` API.
