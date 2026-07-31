# Checklist TI - Frontend UNIVESP

## Base de ambiente

- [ ] Instalar Node.js 20 LTS
- [ ] Se a maquina usar Node 24.x, validar continuidade com a mesma base ja testada pelo Codex
- [ ] Garantir `npm` 10 ou superior no PATH
- [ ] Garantir `C:\Program Files\nodejs` no PATH do shell usado pelo time
- [ ] Liberar acesso ao registro npm ou configurar proxy corporativo
- [ ] Garantir permissao para execucao de scripts PowerShell locais, se necessario
- [ ] Garantir navegador moderno para abrir `dev` e `preview`

## Preparacao inicial

- [ ] Entrar em `univesp-frontend`
- [ ] Rodar `npm install`
- [ ] Gerar `package-lock.json`
- [ ] Copiar `.env.example` para `.env.local`
- [ ] Revisar portas locais `4176` e `4177`, se houver conflito

## Validacao tecnica

- [ ] Rodar `npm run lint`
- [ ] Rodar `npm run typecheck`
- [ ] Rodar `npm run build`
- [ ] Rodar `npm run preview`
- [ ] Confirmar abertura das rotas principais do aluno, OP e admin

## Dependencias que o Codex nao consegue suprir sozinho

- [ ] instalacao real de Node.js
- [ ] instalacao real de dependencias npm
- [ ] definicao de proxy ou certificados internos, se a rede exigir
- [ ] validacao manual do preview em navegador

## Itens de continuidade

- [ ] versionar o `package-lock.json` apos a primeira instalacao valida
- [ ] definir politica institucional para `.env.local` por ambiente
- [ ] decidir a estrategia futura de integracao com Frappe e shell do Sistema de Polos
