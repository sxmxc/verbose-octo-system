# Building the Bulk Connectivity Checker

1. Build the frontend bundle (React externals are provided by the Toolbox shell):

   ```bash
   cd ../../frontend
   pnpm install  # or npm install, if dependencies are missing
   pnpm exec esbuild ../toolkits/connectivity/frontend/index.tsx \
     --bundle \
     --format=esm \
     --platform=browser \
     --outfile=../toolkits/connectivity/frontend/dist/index.js \
     --external:react \
     --external:react-dom \
     --external:react-router-dom \
     --loader:.ts=ts \
     --loader:.tsx=tsx
   ```

2. Package the toolkit:

   ```bash
   cd ../toolkits/scripts
   python package_toolkit.py ../connectivity
   ```

   This produces `connectivity_toolkit.zip` alongside the toolkit directory.
