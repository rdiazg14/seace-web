# seace-web

SPA autenticada del **SEACE Monitor** (asesor de licitaciones menores ENERTRONIC).

- Prod: https://seace.rdiaz-lab.xyz (GitHub Pages)
- Worker (Gemini): https://seace-ai-proxy.rdiazg14.workers.dev — el front **no** llama a Gemini
- Punto de entrada del producto: [TRASPASO_MAESTRO_SEACE.md](https://github.com/rdiazg14/seace-monitor/blob/main/docs/TRASPASO_MAESTRO_SEACE.md)

```bash
npm install
npm run dev          # Vite, puerto 5173
```

`npm run build` → `tsc -b && vite build`. Push a `main` despliega Pages (`.github/workflows/deploy.yml`). Si cambió el Worker, desplegarlo **antes**.

Criterios de negocio: [`docs/CRITERIOS_DECISION_ENERTRONIC.md`](docs/CRITERIOS_DECISION_ENERTRONIC.md).

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
