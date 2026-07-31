# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vue 3 + Vite + Tailwind (preset frappe-ui) no diretório `frontend/`. Back-end Frappe/ERPNext como engine de dados, auth e contratos. Deploy integrado ao ecossistema UNIVESP (Cloud Run / assets Frappe).

## Users

- **Aluno** (~100 mil): busca autosserviço, FAQ guiada e clareza de status do chamado; precisa entender próximo passo sem jargão interno.
- **OP/secretário** (~500): triagem, resolução e handoff com alta produtividade; filas, SLA e prioridade visíveis.
- **Gestor**: atua por exceção; precisa de visão de criticidade sem demanda bruta contínua.
- **Admin**: configura FAQ, filas, permissões e governança de conteúdo com poder progressivo.

## Product Purpose

Sistema Polo/CRM UNIVESP para atendimento institucional: reduzir chamados evitáveis, orientar o aluno ao autosserviço, acelerar triagem operacional e prevenir escalonamento indevido — preservando estabilidade em escala.

## Positioning

Não é um CRM genérico de vendas. É um serviço institucional da UNIVESP integrado ao Frappe, com UX operacional desenhada para escala acadêmica (aluno + polo + central).

## Operating Context

- Operação distribuída em polos (OPs) com equipe central reduzida.
- Fluxos críticos: abertura/consulta de chamado, FAQ guiada, triagem, escalonamento, admin/FAQ Builder.
- Documentação de governança: `AGENTS.md`, `docs/UX_PRINCIPLES_CRM.md`, `docs/SDD_CRM_UNIVESP.md`.
- Design institucional de referência: `docs/design-system-univesp.md` (worktree/univesp-frontend quando aplicável).

## Capabilities and Constraints

- Front Vue consome contratos Frappe; não alterar API/contratos sem alinhamento explícito.
- Patches pequenos e reversíveis; áreas protegidas: auth, rotas, serviços centrais, build/deploy.
- Terminologia operacional padronizada (status, SLA, criticidade).
- Densidade visual varia por perfil (aluno simples; OP produtivo; admin progressivo).

## Brand Commitments

- Identidade UNIVESP: vermelho `#D13239`, cinza `#808285`, tipografia Barlow (títulos) + Open Sans (corpo).
- Deve parecer serviço institucional, não SaaS genérico.
- Continuidade visual com Acesso Unificado UNIVESP.
- Anti-referência: templates CRM genéricos, gradientes roxo-azul, Inter como fonte padrão, cards aninhados, jargão interno exposto ao aluno.

## Evidence on Hand

- Princípios UX: `docs/UX_PRINCIPLES_CRM.md`
- Design system: documentação institucional existente no projeto
- Baseline detector: `npx impeccable detect frontend/src`

## Product Principles

1. Clareza antes de densidade — próximo passo explícito.
2. Autosserviço antes de escalonamento.
3. Progressividade — básico claro, avançado sob demanda.
4. Consistência operacional — mesma tarefa, mesmo padrão.
5. Estabilidade em escala — patch mínimo, risco controlado.

## Accessibility & Inclusion

Alvo WCAG 2.2 AA: contraste, foco visível, teclado, labels, semântica. Mobile prioritário para aluno; desktop para OP/admin.
