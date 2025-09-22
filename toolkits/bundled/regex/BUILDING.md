# Building the Regex Toolkit

1. Confirm `frontend/dist/index.js` is up to date. Bundle it from `frontend/index.tsx` while leaving `react`, `react-dom`, and `react-router-dom` external.
2. Commit the refreshed assets, merge into `main`, and let the Release workflow build the distribution bundle.
3. Download the `toolkit-regex` artifact (containing `regex_toolkit.zip`) from the workflow run or via `gh run download --repo <org>/<repo> --name toolkit-regex`.
4. Install the downloaded archive through **Administration → Toolkits** or the `/toolkits/install` API.
