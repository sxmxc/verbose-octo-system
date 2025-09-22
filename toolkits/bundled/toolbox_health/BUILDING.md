# Building the Toolbox Health Toolkit

1. Bundle the frontend so `frontend/dist/index.js` reflects the latest UI:

   ```bash
   cd frontend
   npx --yes esbuild ../toolkits/bundled/toolbox_health/frontend/index.tsx \
     --bundle \
     --format=esm \
     --platform=browser \
     --outfile=../toolkits/bundled/toolbox_health/frontend/dist/index.js \
     --external:react \
     --external:react-dom \
     --external:react-router-dom \
     --loader:.ts=ts \
     --loader:.tsx=tsx
   ```

2. Commit the refreshed assets, merge into `main`, and let the Release workflow handle packaging.
3. Download the `toolkit-toolbox-health` artifact (containing `toolbox-health_toolkit.zip`) from the workflow run or via `gh run download --repo <org>/<repo> --name toolkit-toolbox-health`.
4. Upload the downloaded archive through **Administration → Toolkits** or via the `/toolkits/install` API.

