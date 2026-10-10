# seace-web

SPA de SEACE Monitor construida con React 19, TypeScript, Vite, React Router, Tailwind y Recharts. Consume Supabase y el proxy IA; ninguna clave privilegiada debe incluirse en el bundle.

## Desarrollo y validación

```powershell
npm ci
npm run dev
npm run build
npm run lint
npm test
```

`npm run build` ejecuta TypeScript y genera `dist/`. Vitest y Testing Library cubren reglas, componentes y flujos con dobles de servicios; no certifican backend real ni QA autenticada extremo a extremo.

## Despliegue

El workflow `.github/workflows/deploy.yml` publica `dist/` en GitHub Pages al hacer push a `main` y crea `404.html` como fallback SPA. Un push puede tener efectos de despliegue. Al cambiar routing, comprobar rutas profundas, sesión, recuperación de clave y dominio configurado.

Solo variables explícitamente públicas de Supabase pertenecen al frontend. Service role, tokens internos y claves IA viven en backend.

En el workspace completo, reglas de producto, frontend y pendientes están en `../docs/`. Este README no mantiene el backlog global.
