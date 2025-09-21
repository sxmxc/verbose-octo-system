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

2. Package the toolkit using the helper script:

   ```bash
   python ../../scripts/package_toolkit.py .
   ```

3. Upload the generated `toolbox-health_toolkit.zip` through **Administration → Toolkits** or via the `/toolkits/install` API.

