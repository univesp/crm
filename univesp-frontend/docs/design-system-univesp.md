# Design System Univesp

## Sistema de Atendimento - Base visual institucional

## 1. Objetivo

Definir o padrao visual do frontend do Sistema de Atendimento da Univesp, garantindo:

- aderencia a identidade institucional
- consistencia entre areas de aluno, OP e admin
- boa usabilidade
- acessibilidade desde a base
- facilidade de evolucao para modulo do Sistema de Polos

---

## 2. Principios visuais

A interface deve transmitir:

- clareza
- institucionalidade
- simplicidade
- confianca
- orientacao guiada
- baixo ruido visual

O sistema nao deve parecer um CRM generico.
Ele deve parecer um servico institucional da Univesp.

---

## 3. Identidade visual institucional

### 3.1. Cores institucionais base

Usar como base primaria:

- Vermelho Univesp: `#D13239`
- Cinza institucional: `#808285`
- Preto: `#000000`
- Branco: `#FFFFFF`

### 3.2. Cores semanticas complementares

Definir cores derivadas para estados de interface:

- sucesso
- alerta
- erro
- informacao
- criticidade alta
- criticidade media
- criticidade baixa
- SLA vencido
- SLA proximo do vencimento

Essas cores devem respeitar contraste minimo de acessibilidade.

### 3.3. Tipografia

- Titulos e destaques: **Barlow**
- Texto corrido, labels, mensagens e formularios: **Open Sans**

### 3.4. Uso da marca

- Priorizar logo completo ou simplificado conforme espaco disponivel.
- O simbolo isolado nao deve substituir a identificacao institucional principal.
- Em areas compactas, o simbolo pode ser usado como apoio visual, icone ou avatar, mas nao como assinatura principal da interface.

### 3.5. Continuidade com o Acesso Unificado

- A entrada no Sistema de Atendimento deve parecer parte do ecossistema institucional da Univesp.
- A transicao visual entre Acesso Unificado e Atendimento deve preservar confianca, clareza e leitura institucional.
- O frontend pode ter identidade propria de modulo, mas nao deve romper com a linguagem superior da instituicao.

---

## 4. Diretriz visual do produto

### 4.1. Estilo

- layout limpo
- cards bem definidos
- espacamento generoso
- foco em leitura e acao
- hierarquia clara
- poucos elementos simultaneos por tela

### 4.2. Forma dos componentes

- bordas arredondadas moderadas
- botoes grandes e claros
- campos amplos
- estados visuais evidentes
- foco visivel para teclado

### 4.3. Densidade visual por perfil

#### Aluno

- interface simples
- poucas acoes por etapa
- textos objetivos
- fluxo guiado

#### OP

- foco em produtividade
- visao clara de fila, prioridade, SLA e acao
- painel lateral de apoio operacional

#### Admin e gestao

- visao executiva
- filtros e dashboards
- controle de FAQ, filas, permissoes e criticidade

### 4.4. Destaque sazonal por calendario academico

- temas prioritarios devem ganhar destaque visual na home conforme o periodo academico
- badges, chips e cards de destaque devem refletir janelas como provas, matricula, ENADE e colacao
- o destaque sazonal nao deve quebrar a previsibilidade da navegacao

---

## 5. Componentes visuais base

Criar tokens e componentes para:

- Topbar institucional
- Sidebar
- PageHeader
- Card
- StatCard
- StatusBadge
- PriorityBadge
- SlaBadge
- EmptyState
- ErrorState
- StepCard
- FAQCard
- TicketCard
- TimelineItem
- Table
- FilterChip
- FormField
- UploadBox

---

## 6. Tokens recomendados

### 6.1. Tokens de cor

- `--color-primary`
- `--color-primary-dark`
- `--color-primary-soft`
- `--color-neutral-0`
- `--color-neutral-100`
- `--color-neutral-200`
- `--color-text`
- `--color-text-muted`
- `--color-success`
- `--color-warning`
- `--color-danger`
- `--color-info`
- `--color-sla-overdue`
- `--color-sla-soon`

### 6.2. Tokens de tipografia

- `--font-heading`
- `--font-body`
- `--font-size-xs`
- `--font-size-sm`
- `--font-size-md`
- `--font-size-lg`
- `--font-size-xl`
- `--font-size-2xl`

### 6.3. Tokens de espacamento

- `--space-1`
- `--space-2`
- `--space-3`
- `--space-4`
- `--space-5`
- `--space-6`

### 6.4. Tokens de superficie

- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--border-default`

### 6.5. Base implementada na stack atual

- cores institucionais derivadas de `#D13239`, `#808285`, `#000000` e `#FFFFFF`
- tipografia com `Barlow` para heading e `Open Sans` para body
- superficies claras com borda suave e sombra moderada
- estados semanticos para status, prioridade, criticidade e SLA

---

## 7. Acessibilidade

O sistema deve nascer alinhado a WCAG 2.2 AA, incluindo:

- contraste adequado
- foco visivel
- navegacao por teclado
- semantica adequada para leitor de tela
- labels explicitos
- suporte a aumento de fonte
- possibilidade de temas e contraste
- base preparada para VLibras e recursos assistivos

---

## 8. Diretriz para responsividade

- Desktop e prioritario para OP e admin.
- Mobile e tablet devem ser priorizados para aluno.
- Layouts devem se reorganizar sem quebrar fluxos.
- Em telas menores, a experiencia deve continuar orientada por etapas.

---

## 9. Resultado esperado

Toda nova tela deve parecer:

- institucionalmente Univesp
- simples de usar
- auditavel e confiavel
- pronta para crescer dentro do Sistema de Polos
