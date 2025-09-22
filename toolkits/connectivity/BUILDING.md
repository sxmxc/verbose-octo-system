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

2. Trigger packaging in CI:

   - Commit the refreshed bundle to a branch, submit a pull request, and merge into `main`.
   - The Release workflow emits a `toolkit-connectivity` artifact that contains `connectivity_toolkit.zip`. Download it from the workflow run or via `gh run download --repo <org>/<repo> --name toolkit-connectivity`.
