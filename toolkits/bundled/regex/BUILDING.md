# Building the Regex Toolkit

1. Confirm `frontend/dist/index.js` is up to date. Bundle it from `frontend/index.tsx` while leaving `react`, `react-dom`, and `react-router-dom` external.
2. Package the toolkit with the helper script:

```bash
python ../../scripts/package_toolkit.py .
```

3. Install the resulting `regex_toolkit.zip` through **Administration → Toolkits** or the `/toolkits/install` API.
