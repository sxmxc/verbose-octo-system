# Building the API Checker Toolkit

1. **Bundle the frontend UI** (React, React Router, and runtime APIs are provided by the Toolbox shell):

   ```bash
   cd frontend
   pnpm install  # install dependencies if needed
   pnpm exec esbuild ../toolkits/api_checker/frontend/index.tsx \
     --bundle \
     --format=esm \
     --platform=browser \
     --outfile=../toolkits/api_checker/frontend/dist/index.js \
     --external:react \
     --external:react-dom \
     --external:react-router-dom \
     --loader:.ts=ts \
     --loader:.tsx=tsx
   ```

2. **Trigger packaging via CI**:

   - Commit the updated bundle to a branch, open a pull request, and merge into `main`.
   - The Release workflow packages the toolkit automatically. Download the `toolkit-api-checker` artifact (which contains `api-checker_toolkit.zip`) from the workflow run or fetch it via `gh run download --repo <org>/<repo> --name toolkit-api-checker`.
