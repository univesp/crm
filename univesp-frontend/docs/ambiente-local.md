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

1. copiar `.env.example` para `.env.local`
2. manter `VITE_ENABLE_MOCKS=true` nesta fase
3. nao usar endpoints reais enquanto o backend nao estiver habilitado

Exemplo:

```bash
cp .env.example .env.local
```

No PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Se o PowerShell bloquear `npm.ps1`, usar `npm.cmd` ou ajustar a politica de execucao local conforme a TI definir.

## Comandos de desenvolvimento

```bash
npm run dev
```

Padrao atual:

- host dev: `0.0.0.0`
- porta dev: `4176`
- host preview: `0.0.0.0`
- porta preview: `4177`

Esses valores podem ser ajustados por `.env.local` via `VITE_DEV_HOST`, `VITE_DEV_PORT`, `VITE_PREVIEW_HOST`, `VITE_PREVIEW_PORT` e `VITE_APP_BASE`.

## Comandos de validacao

```bash
npm run lint
npm run typecheck
npm run build
npm run preview
```

Comando agregado:

```bash
npm run check
```

## Setup script local

Scripts propostos:

- `scripts/setup-local.ps1`
- `scripts/setup-local.sh`

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

## Observacao para o futuro modulo do Sistema de Polos

O `vite.config.js` agora aceita `VITE_APP_BASE`, o que ajuda a publicar este frontend abaixo de um caminho base futuro sem reestruturar a aplicacao.
