# Task Management Frontend

React 19, TypeScript, Vite, Tailwind CSS, and shadCN components for the internal infrastructure task tracker.

## Local development

The backend must be running with `APP_AUTH_USERNAME` and `APP_AUTH_PASSWORD` set.

```sh
cp .env.example .env
npm ci
npm run dev
```

The Vite dev server proxies `/api` to `VITE_API_PROXY_TARGET` (default `http://127.0.0.1:8080`), so authenticated requests stay same-origin during development.

## Authentication

Sign in with the credentials configured on the backend. Credentials are held in memory for the current tab only; they are never written to `localStorage`, `sessionStorage`, or cookies. API responses are validated at runtime before rendering, and task content is always rendered as text.

## Scripts

```sh
npm run dev      # development server
npm test         # Vitest test suite
npm run lint     # Oxlint
npm run build    # type-check and production build
```

## Docker

```sh
docker compose up -d --build
```

Nginx serves the built assets and reverse-proxies `/api/` to `API_UPSTREAM` (default `http://app:8080`). Set `API_UPSTREAM` when the backend container uses a different hostname or network. Keeping the API same-origin lets the Content-Security-Policy stay at `connect-src 'self'`.
