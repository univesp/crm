# Ambiente Local e Preview

## Objetivo

Documentar o que a TI e o time de frontend precisam para instalar dependencias, subir o frontend localmente e validar preview e build sem depender de backend real.

## Inventario tecnico atual

- framework: Vue 3
- bundler: Vite 5
- estado: Pinia
- rotas: Vue Router em `src/router.js`
- estilos: Tailwind CSS + tokens locais
- package manager recomendado: `npm`
- modo atual: mock-first, sem backend real

## Arquivos de configuracao relevantes

- `package.json`
- `vite.config.js`
- `tailwind.config.js`
- `postcss.config.js`
- `.env.example`
- `eslint.config.js`
- `tsconfig.json`
- `.nvmrc`

## Versao recomendada

- Node.js: 20 LTS
- Node.js 24.14.0: validado neste workspace
- npm: 10 ou superior

Motivo:

- a stack atual em Vite 5, Vue 3 e plugin Vue funciona bem em Node 20
- a recomendacao evita acoplamento precoce a versoes mais novas sem validacao local
- ainda assim, este projeto foi validado com `node v24.14.0` e `npm 11.9.0`

## Package manager recomendado

Usar `npm` como padrao deste diretorio.

Motivos:

- `package.json` ja esta preparado para `npm`
- ainda nao existe lockfile versionado
- o `.gitignore` foi ajustado para permitir futura geracao e commit do `package-lock.json`

## Comandos de instalacao

```bash
cd univesp-frontend
npm install
```

## Variaveis de ambiente

1. para primeira configuracao, usar um dos perfis locais prontos:
   - `.env.local.admin`
   - `.env.local.op`
   - `.env.local.aluno`
2. manter `VITE_ENABLE_MOCKS=true` nesta fase
3. manter `VITE_SSO_DEV_BYPASS=true` para testes locais sem gateway
4. usar `VITE_SSO_GATEWAY_PROXY_TARGET=http://localhost:4000` somente quando o gateway estiver rodando localmente
5. nao usar endpoints reais enquanto o backend nao estiver habilitado

Exemplo:

No PowerShell:

```powershell
.\scripts\use-admin.ps1
```

Se o PowerShell bloquear `npm.ps1`, usar `npm.cmd` ou ajustar a politica de execucao local conforme a TI definir.

## Alternancia de perfis locais

Atalhos disponiveis:

- `.\scripts\use-admin.ps1`
- `.\scripts\use-op.ps1`
- `.\scripts\use-aluno.ps1`

Se a politica de execucao do PowerShell bloquear a chamada direta, use:

- `powershell -ExecutionPolicy Bypass -File .\scripts\use-admin.ps1`
- `powershell -ExecutionPolicy Bypass -File .\scripts\use-op.ps1`
- `powershell -ExecutionPolicy Bypass -File .\scripts\use-aluno.ps1`

Cada script copia o respectivo arquivo de perfil para `.env.local`, `.env.development.local` e `.env.production.local`:

- `use-admin.ps1` -> `.env.local.admin`
- `use-op.ps1` -> `.env.local.op`
- `use-aluno.ps1` -> `.env.local.aluno`

Perfis configurados:

- admin/gestao: `admin@univesp.br`
- OP/area: `op@polo.univesp.br`
- aluno: `teste@aluno.univesp.br`

Entrada local mais simples:

- abra `http://localhost:8080/crm/acesso-local`
- escolha `Admin e gestao`, `OP e area` ou `Aluno`
- o frontend grava o perfil local no navegador e redireciona para a area correspondente

Importante:

- depois de trocar o perfil, pare e suba o Vite novamente
- o bypass de SSO e lido no startup do `npm run dev`
- em `development`, o arquivo local com maior precedencia e `.env.development.local`
- esses perfis nao usam senha; o frontend local entra em modo bypass/mock

## Comandos de desenvolvimento

```bash
npm run dev
```

Padrao dos perfis locais prontos:

- host dev: `0.0.0.0`
- porta dev: `8080`
- host preview: `0.0.0.0`
- porta preview: `8080`

Esses valores podem ser ajustados por `.env.local` ou `.env.development.local` via `VITE_DEV_HOST`, `VITE_DEV_PORT`, `VITE_PREVIEW_HOST`, `VITE_PREVIEW_PORT` e `VITE_APP_BASE`.

Fluxo recomendado:

```powershell
Set-Location C:\Users\bruno\Documents\crm\univesp-frontend
npm run dev
```

Depois de subir o Vite:

- abra `http://localhost:8080/crm/acesso-local`
- selecione o perfil desejado

Alternativa quando o PowerShell bloquear a execucao direta do script:

```powershell
Set-Location C:\Users\bruno\Documents\crm\univesp-frontend
powershell -ExecutionPolicy Bypass -File .\scripts\use-admin.ps1
npm run dev
```

Se trocar para outro perfil enquanto o Vite estiver aberto:

1. interrompa o processo atual
2. rode o script do novo perfil
3. suba `npm run dev` novamente

## Rotas para teste local por perfil

Base local:

- `http://localhost:8080/crm/`
- `http://localhost:8080/crm/acesso-local`

Admin / Gestao:

- `http://localhost:8080/crm/admin/dashboard`
- `http://localhost:8080/crm/admin/faq`
- `http://localhost:8080/crm/admin/parametros`
- `http://localhost:8080/crm/admin/permissoes`
- `http://localhost:8080/crm/admin/publicacao`

OP / Area:

- `http://localhost:8080/crm/op/fila`
- `http://localhost:8080/crm/op/playbook`

Aluno:

- `http://localhost:8080/crm/aluno`
- `http://localhost:8080/crm/aluno/solicitacoes`

## Comandos de validacao

```bash
npm run lint
npm run typecheck
npm run build
npm run preview
npm run review
```

Comando agregado:

```bash
npm run check
```

## Setup script local

Scripts propostos:

- `scripts/setup-local.ps1`
- `scripts/setup-local.sh`
- `scripts/start-review.ps1`
- `scripts/start-review.cmd`

Eles fazem apenas:

- verificacao de `node` e `npm`
- copia inicial de `.env.example` para `.env.local`, se necessario
- `npm install`
- exibicao dos proximos comandos

## O que o Codex conseguiu preparar

- scripts de `lint`, `typecheck`, `preview` e `check`
- configuracao de ESLint para `.js` e `.vue`
- configuracao de `vue-tsc`
- suporte configuravel de host, porta e `base` no Vite
- `.nvmrc`
- documentacao operacional para dev e TI
- `npm install`, `lint`, `typecheck` e `build` validados com sucesso

## O que ainda falta para executar localmente

- `C:\Program Files\nodejs` presente no `PATH` da sessao ou shell usado pelo frontend
- acesso ao registro npm ou proxy corporativo equivalente
- abertura manual do `preview` no shell do time para validacao visual continua

## Bloqueios do ambiente atual do Codex

No ambiente atual, o Codex encontrou estes bloqueios:

- `node` e `npm` existem, mas nao aparecem no `PATH` herdado pela sessao
- `npm.ps1` ficou sujeito a politica de execucao do PowerShell
- `npm install` e `npm run build` precisaram de permissao ampliada para sair do sandbox
- o `preview` nao foi mantido aberto nesta automacao porque ele exige um processo interativo em execucao continua

## Fluxo recomendado para homologacao visual estavel

Quando a prioridade for revisar interface e navegacao, prefira `build + preview` em vez de `npm run dev`.

Opcao mais simples no Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-review.ps1 -LocalProfile aluno
```

Ou pelo atalho `.cmd`:

```cmd
scripts\start-review.cmd aluno
```

Perfis aceitos:

- `aluno`
- `op`
- `admin`

Esse fluxo faz:

1. ativa o perfil local escolhido
2. roda `vite build --mode development`
3. sobe `npm run preview:local`
4. mantem o terminal servindo `http://localhost:8080/crm/`

Importante:

- mantenha o terminal aberto durante a homologacao
- use `Ctrl + C` para encerrar o preview

## Observacao para o futuro modulo do Sistema de Polos

O `vite.config.js` agora aceita `VITE_APP_BASE`, o que ajuda a publicar este frontend abaixo de um caminho base futuro sem reestruturar a aplicacao.
