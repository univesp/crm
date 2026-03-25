# UNIVESP Frontend

Frontend institucional do Sistema de Atendimento da Univesp, construido como camada propria em Vue 3 e preparado para operar em modo mock agora e integrar com Frappe depois.

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
cp .env.example .env.local
```

No Windows PowerShell:

```powershell
Set-Location .\univesp-frontend
Copy-Item .env.example .env.local
```

Scripts de apoio:

- `scripts/setup-local.ps1`
- `scripts/setup-local.sh`

## Scripts disponiveis

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run typecheck`
- `npm run check`

## Variaveis de ambiente

As variaveis base estao em `.env.example`. Nesta fase:

- `VITE_ENABLE_MOCKS=true` mantem o frontend desacoplado de backend real
- `VITE_APP_BASE`, `VITE_DEV_PORT` e `VITE_PREVIEW_PORT` ajudam no encaixe futuro como modulo
- URLs de Frappe, SAML, IA e handoff sao placeholders e nao representam integracoes ativas

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
- `docs/ti-checklist-frontend.md`

## Limites desta fase

- nao ha integracao real com backend
- nao ha autenticacao real
- o preview local ainda depende de abertura manual de servidor no shell do time
- o shell do Codex nao herda `C:\Program Files\nodejs` automaticamente no `PATH`, entao a validacao precisou usar o executavel instalado de forma explicita
