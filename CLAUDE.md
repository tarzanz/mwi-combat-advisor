# Working in this repository

- Commit and push directly to `main`. Do not create feature branches or pull requests unless asked.
- Each release bumps `version` in `package.json`, rebuilds `dist/` (`npm run build`) and updates `README.md`;
  the commit message ends with the version, e.g. `(v0.35.1)`.
- Before pushing, run the unit tests (`node test/*-test.mjs`) and the browser test of what changed
  (`BROWSER_PATH=<chromium> node test/<name>-browser-test.mjs <screenshot-dir>`).
