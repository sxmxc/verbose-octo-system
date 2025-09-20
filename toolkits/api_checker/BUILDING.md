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

2. **Package the toolkit** once the bundle is generated:

   ```bash
   cd ../toolkits/scripts
   python package_toolkit.py ../api_checker
   ```

   A distributable archive named `api-checker_toolkit.zip` will be created alongside the toolkit directory.
