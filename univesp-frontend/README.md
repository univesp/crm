# UNIVESP Frontend

Frontend institucional do Sistema de Atendimento da Univesp, construido em Vue 3. O acesso ao app usa o mesmo padrao de SSO do SGP e o Frappe CRM fica restrito ao consumo de API.

## Stack atual

- Framework: Vue 3
- Bundler e dev server: Vite 5
- Estado: Pinia
- Rotas: Vue Router
- Estilizacao: Tailwind CSS + tokens locais em `src/index.css`
- Linguagem: JavaScript com componentes `.vue`
- Package manager recomendado: `npm`

## Requisitos locais

- Node.js 20 LTS recomendado
- Node.js 24.x validado neste workspace, embora 20 LTS siga como referencia recomendada
- npm 10 ou superior
- acesso ao registro npm configurado na rede da TI
- navegador moderno para preview local

Arquivo auxiliar:

- `.nvmrc`

## Primeira preparacao

```bash
cd univesp-frontend
npm install
cp .env.development .env.local
```

No Windows PowerShell:

```powershell
Set-Location .\univesp-frontend
Copy-Item .env.development .env.local
```

Scripts de apoio:

- `scripts/setup-local.ps1`
- `scripts/setup-local.sh`

## Scripts disponiveis

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run preview:local`
- `npm run review`
- `npm run lint`
- `npm run typecheck`
- `npm run check`

## Variaveis de ambiente

As variaveis base estao em:

- `.env.example`: referencia geral
- `.env.development`: compose e Vite local em `http://localhost:8080/crm`
- `.env.production`: espelho da homolog em `https://homolog-crm.univesp.br/`

Nesta fase:

- `VITE_ENABLE_MOCKS=true` mantem o frontend desacoplado de backend real
- `VITE_APP_BASE`, `VITE_DEV_PORT` e `VITE_PREVIEW_PORT` ajudam no encaixe futuro como modulo
- `VITE_APP_API_BASE=/api/app/v1` usa o BFF no mesmo host publico
- `SSO_GATEWAY_ORIGIN` aponta o Nginx para o gateway interno
- `VITE_SSO_SESSION_PATH=/api/me` replica o contrato de sessao do SGP
- `VITE_SSO_START_PATH`, `VITE_SSO_AZURE_START_PATH` e `VITE_SSO_SAML_START_PATH` iniciam os fluxos SSO
- `VITE_SAML_ACS_URL`, `VITE_SAML_LOGOUT_URL` e `VITE_AZURE_REDIRECT_URI` recebem os callbacks publicos do gateway
- `VITE_APP_BASE=/` e `VITE_ROUTER_BASE=/` publicam a tela inicial no dominio raiz da homolog

## Autenticacao e API

O `univesp-frontend` fica na frente do dominio publico, mas o Nginx do container
encaminha somente as rotas publicas do gateway:

- `/api/app/v1/*` -> SSO Gateway/BFF -> app Frappe interno
- `/api/method/*`, `/api/resource/*`, `/private/files/*` -> bloqueados externamente
- `/socket.io/*` -> Frappe socket.io
- `/api/me`, `/api/sso/*` -> SSO gateway
- `/`, `/login` e demais rotas institucionais -> frontend UNIVESP

O app separa autenticacao de integracao de negocio:

- `src/services/ssoClient.js`: sessao atual em `/api/me`, inicio de login em `/api/sso/*` e logout institucional
- `src/services/appApi.js`: contrato publico same-origin do BFF
- `src/services/frappeClient.js`: adaptadores de negocio para ticket e handoff

Fluxo esperado:

1. o usuario entra pela tela SSO identica ao SGP
2. `/api/sso/start` classifica o email e redireciona para Azure AD ou SAML
3. o gateway devolve para `/` com sessao institucional ativa
4. o frontend valida a sessao em `/api/me`
5. com a sessao aprovada, o app usa `/api/app/v1`; o gateway chama o Frappe internamente

Nao coloque `api_secret` em variavel `VITE_`. Tudo que entra em `VITE_*` vai para o bundle do navegador.

## Configuracao local sugerida

O arquivo versionado [`.env.development`](/home/lukakas/dev/univesp/crm/univesp-frontend/.env.development) ja traz a configuracao local sugerida:

```bash
VITE_ENABLE_MOCKS=false
VITE_APP_BASE=/crm/
VITE_ROUTER_BASE=/crm/
VITE_APP_API_BASE=/api/app/v1
VITE_SSO_SESSION_PATH=/api/me
VITE_SSO_START_PATH=/api/sso/start
VITE_SSO_AZURE_START_PATH=/api/sso/azure/start
VITE_SSO_SAML_START_PATH=/api/sso/saml/start
VITE_SSO_LOGOUT_PATH=/api/sso/logout
VITE_SAML_ENTITY_ID=crm_development
VITE_SAML_NAME_ID_FORMAT=urn:oasis:names:tc:SAML:2.0:nameid-format:email
VITE_SAML_NAME_ID_ATTRIBUTE=mail
VITE_SAML_ACS_URL=http://localhost:8080/consume
VITE_SAML_LOGOUT_URL=http://localhost:8080/logout
VITE_AZURE_REDIRECT_URI=http://localhost:8080/api/sso/azure/callback
```

## Configuracao de homolog

O arquivo versionado [`.env.production`](/home/lukakas/dev/univesp/crm/univesp-frontend/.env.production) espelha a homolog publicada por GitHub Actions no Cloud Run:

```bash
VITE_ENABLE_MOCKS=false
VITE_APP_BASE=/
VITE_ROUTER_BASE=/
VITE_APP_API_BASE=/api/app/v1
VITE_SSO_SESSION_PATH=/api/me
VITE_SSO_START_PATH=/api/sso/start
VITE_SSO_AZURE_START_PATH=/api/sso/azure/start
VITE_SSO_SAML_START_PATH=/api/sso/saml/start
VITE_SSO_LOGOUT_PATH=/api/sso/logout
VITE_SAML_ENTITY_ID=crm_production
VITE_SAML_NAME_ID_FORMAT=urn:oasis:names:tc:SAML:2.0:nameid-format:email
VITE_SAML_NAME_ID_ATTRIBUTE=mail
VITE_SAML_ACS_URL=https://homolog-crm.univesp.br/consume
VITE_SAML_LOGOUT_URL=https://homolog-crm.univesp.br/logout
VITE_AZURE_REDIRECT_URI=https://homolog-crm.univesp.br/login
```

Variaveis esperadas no servico Cloud Run que serve este frontend:

```bash
FRAPPE_WEB_ORIGIN=https://<origem-frappe-web>
FRAPPE_SOCKETIO_ORIGIN=https://<origem-frappe-socketio>
SSO_GATEWAY_ORIGIN=https://<origem-sso-gateway>
```

## Execucao local

Para subir apenas o frontend:

```bash
cd /home/lukakas/dev/univesp/crm/univesp-frontend
npm install
npm run dev
```

Para homologacao visual mais estavel, prefira:

```bash
npm run review
```

No Windows, o atalho mais simples e:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-review.ps1 -LocalProfile aluno
```

Ou:

```cmd
scripts\start-review.cmd aluno
```

URLs esperadas:

- `http://localhost:8080/crm`
- `http://localhost:8080/crm/acesso-local`
- sem backend local: usar os perfis `.env.local.admin`, `.env.local.op` ou `.env.local.aluno`
- com gateway local: configure `VITE_SSO_GATEWAY_PROXY_TARGET=http://localhost:4000`

Observacao: no modo mock/bypass local, nao ha senha. A forma mais simples e:

- abrir `http://localhost:8080/crm/acesso-local`
- escolher `Admin e gestao`, `OP e area` ou `Aluno`

Alternativamente, troque o perfil por:

- `./scripts/use-admin.ps1`
- `./scripts/use-op.ps1`
- `./scripts/use-aluno.ps1`

Se o PowerShell bloquear a execucao direta, use:

- `powershell -ExecutionPolicy Bypass -File ./scripts/use-admin.ps1`
- `powershell -ExecutionPolicy Bypass -File ./scripts/use-op.ps1`
- `powershell -ExecutionPolicy Bypass -File ./scripts/use-aluno.ps1`

Depois de trocar o perfil, reinicie o `npm run dev`. Os scripts atualizam `.env.local`, `.env.development.local` e `.env.production.local`, para que `dev` e `review` usem o mesmo perfil local sem cair na base de homolog.

## Docker Compose local

Existe um compose local em [docker-compose.yml](/home/lukakas/dev/univesp/crm/univesp-frontend/docker-compose.yml) que sobe:

- `mariadb`
- `redis`
- `frappe`
- `univesp-frontend`

Esse modo usa:

- proxy do Vite para falar com o Frappe em `http://frappe:8000`
- token tecnico do Frappe para integrar a API
- bypass local de SSO no frontend, sem usar login do Frappe

Passos:

1. Preencha [`.env.compose.example`](/home/lukakas/dev/univesp/crm/univesp-frontend/.env.compose.example) com `FRAPPE_API_KEY` e `FRAPPE_API_SECRET`.
2. Rode:

```bash
cd /home/lukakas/dev/univesp/crm/univesp-frontend
docker compose --env-file .env.compose.example up --build
```

URLs:

- frontend: `http://localhost:8080/crm`
- frappe desk: `http://localhost:8000`
- socket.io: `http://localhost:9000`

Observacao: esse compose e para dev local. Ele deixa a API funcionando sem depender do gateway SSO, mas nao substitui o fluxo SAML/Azure da homolog.

## Acesso na homolog

Depois do deploy por GitHub Actions:

- tela inicial do `univesp-frontend`: `https://homolog-crm.univesp.br/`
- CRM nativo do Frappe: `https://homolog-crm.univesp.br/crm`

## Credenciais do Frappe

Credenciais tecnicas pertencem apenas ao gateway/secret manager. Nao existe
modo suportado de token no navegador, nem mesmo em homologacao. Para testes
locais, execute o gateway ou use mocks explicitamente habilitados.

## Como gerar API Key no Frappe

Se eu nao puder gerar daqui, faca assim no ambiente local do compose:

1. Suba o Frappe.
2. Abra `http://localhost:8000`.
3. Entre com `Administrator` e senha `admin`.
4. Abra o usuario que vai ser usado pela integracao.
5. Na secao `API Access`, clique em `Generate Keys`.
6. Copie `API Key` e `API Secret`.
7. Preencha esses valores em [`.env.compose.example`](/home/lukakas/dev/univesp/crm/univesp-frontend/.env.compose.example).

Se preferir um usuario tecnico em vez do `Administrator`, crie esse usuario primeiro no Desk e gere as chaves nele. Para o `univesp-frontend`, o header esperado fica assim:

```text
Authorization: token API_KEY:API_SECRET
```

## Rotas atuais

- Institucional: `/`, `/integracoes`, `/triagem`, `/ticket`, `/chat-ia`, `/handoff`
- Aluno: `/aluno`, `/aluno/protocolo`, `/aluno/solicitacoes`, `/aluno/solicitacoes/:protocolId`
- OP: `/op/fila`, `/op/playbook`
- Admin: `/admin/dashboard`, `/admin/faq`

As rotas ficam centralizadas em `src/router.js`.

## Estrutura

- `src/pages`: paginas e rotas
- `src/components`: componentes reutilizaveis
- `src/stores`: estado local
- `src/services`: runtime, catalogos e contratos futuros
- `mocks`: dados mockados e exemplos de importacao
- `docs`: documentacao funcional, tecnica e operacional

## Documentacao operacional

- `docs/ambiente-local.md`
- `docs/frappe-crm-auth.md`
- `docs/ti-checklist-frontend.md`

## Limites desta fase

- a autenticacao real depende de um gateway expondo `/api/me` e `/api/sso/*`
- segredos do Frappe nao podem ser embutidos no bundle do frontend
- o preview local ainda depende de abertura manual de servidor no shell do time
- o shell do Codex nao herda `C:\Program Files\nodejs` automaticamente no `PATH`, entao a validacao precisou usar o executavel instalado de forma explicita
