---
name: CRM UNIVESP
description: Interface institucional de atendimento — clara, confiável, orientada a operação em escala
colors:
  primary: "#D13239"
  primary-dark: "#A8282E"
  neutral-institutional: "#808285"
  neutral-bg: "#FFFFFF"
  neutral-surface: "#F8F9FA"
  text: "#1A1A1A"
  text-muted: "#5C5C5C"
  success: "#2E7D32"
  warning: "#ED6C02"
  danger: "#D13239"
  info: "#0288D1"
typography:
  heading:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontWeight: 600
  body:
    fontFamily: "\"Open Sans\", system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  status-badge:
    rounded: "{rounded.sm}"
    padding: "4px 10px"
---

## Overview

Interface de produto (app UI) para o Sistema Polo/CRM UNIVESP. Visual institucional, baixo ruído, hierarquia clara e foco em leitura + ação. Base técnica: Vue 3 + frappe-ui + Tailwind preset frappe-ui em `frontend/`.

**Autoridade complementar (não substituir):** `docs/UX_PRINCIPLES_CRM.md` (operacional), `AGENTS.md` (governança). Este arquivo governa **aparência e consistência visual**.

## Colors

- **Primária:** vermelho UNIVESP `#D13239` — CTAs, destaques institucionais, marca.
- **Neutros:** cinza institucional `#808285`, superfícies claras, texto `#1A1A1A` / muted `#5C5C5C`.
- **Semânticas:** sucesso, alerta, erro, info, SLA vencido/próximo — sempre com contraste WCAG AA.
- **Não usar:** gradientes roxo-azul genéricos, cinza puro `#000`/`#999` sem tint, texto cinza claro sobre fundo colorido.

## Typography

- **Títulos:** Barlow — hierarquia clara, peso moderado a semibold.
- **Corpo:** Open Sans — labels, formulários, mensagens, microcopy operacional.
- **Evitar:** Inter, Arial, system-ui como escolha estética principal.

## Layout

- Layout limpo; cards bem definidos; espaçamento generoso.
- **Aluno:** poucas ações por etapa; fluxo guiado; mobile-first.
- **OP:** fila, prioridade, SLA e ação primária visíveis; painel lateral de apoio.
- **Admin/gestão:** filtros, dashboards, configuração progressiva.
- Desktop prioritário para OP/admin; mobile/tablet para aluno.

## Elevation & Depth

- Sombras moderadas (`shadow-sm` / `shadow-md`); bordas suaves.
- Evitar cards aninhados em cards; evitar `border-l-4` como accent de card (anti-slop Impeccable).
- Profundidade por hierarquia de conteúdo, não por efeitos decorativos.

## Shapes

- Border-radius moderado (4–12px).
- Botões amplos e legíveis; campos com área de toque adequada.
- Foco visível para teclado em todos os interativos.

## Components

Tokens e padrões esperados (frappe-ui + custom):

- Topbar institucional, Sidebar, PageHeader
- Card, StatCard, StatusBadge, PriorityBadge, SlaBadge
- EmptyState, ErrorState, StepCard, FAQCard, TicketCard
- TimelineItem, Table, FilterChip, FormField, UploadBox

Estados visuais evidentes: hover, disabled, loading, erro com recuperação orientada.

## Do's and Don'ts

**Do**
- Parecer serviço institucional UNIVESP, não CRM genérico.
- Uma ação primária clara por contexto.
- Linguagem simples na UI (ver `crm-ux-review`).
- Contraste e foco acessíveis.

**Don't**
- Side-tab accent (`border-l-4` em cards) — tique de UI gerada por IA.
- Múltiplas ações primárias concorrentes.
- Redesign amplo ou mudança de arquitetura sem solicitação.
- Sobrescrever tokens frappe-ui sem necessidade operacional.
