# Piu Mobile

Painel de demandas de design e engenharia. Frontend Vite + API Express/Prisma/SQLite.

## Como rodar

1. Copie `.env.example` para `.env` e troque `AUTH_SECRET` e as senhas do seed.
2. Instale e crie o banco:

```bash
npm install
npm run db:setup
```

3. Suba API e frontend em dois terminais:

```bash
npm run dev:api
npm run dev
```

A API fica em `http://localhost:3001`. O Vite (`http://localhost:5173`) encaminha `/api` para ela.

Para trazer o banco da origem, pare a API, copie o arquivo SQLite para `server/prisma/dev.db` e rode `npm run db:push` se o schema local tiver tabela a mais. O arquivo fica fora do git. Não grave senha no README.

Login do seed: `ADMIN` / senha em `SEED_ADMIN_SENHA` (padrão `piumobile`). Colaboradores usam o mesmo valor de `SEED_USER_SENHA`.

## Scripts

| Script | Função |
| --- | --- |
| `npm run dev` | Frontend Vite |
| `npm run dev:api` | API com `--watch` |
| `npm run db:push` | Aplica o schema SQLite |
| `npm run db:seed` | Catálogo, fluxo padrão e usuários |
| `npm run smoke` | Paridade do fluxo (API no ar). Login em `SMOKE_LOGIN` / `SMOKE_SENHA` |
| `npm run lint` | Oxlint |
| `npm run build` | Build do frontend |
