# Auto Deploy no GitHub + Vercel

Este projeto esta configurado com workflow em:

- `.github/workflows/deploy-vercel.yml`

## O que acontece

- Em `pull_request` para `main`: roda CI (`npm ci`, `npm run lint`, `npm run build`).
- Em `push` na `main`: roda CI e depois faz deploy em producao na Vercel.

## Secrets necessarios no GitHub

No repositorio GitHub, abra:

- `Settings > Secrets and variables > Actions > New repository secret`

Crie estes 3 secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Como obter os valores

1. `VERCEL_TOKEN`
- Vercel Dashboard > Settings > Tokens > Create Token.

2. `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`
- Na raiz do projeto, rode localmente:

```bash
vercel link
```

- Depois confira o arquivo `.vercel/project.json` (na sua maquina, nao versionar):
  - `orgId` -> `VERCEL_ORG_ID`
  - `projectId` -> `VERCEL_PROJECT_ID`

## Variaveis de ambiente na Vercel

No projeto da Vercel, configure:

- `OPENAI_API_KEY`

Em:

- `Vercel Project > Settings > Environment Variables`

## Fluxo de uso

1. Fazer commit
2. `git push origin main`
3. GitHub Actions executa CI e deploy automaticamente
