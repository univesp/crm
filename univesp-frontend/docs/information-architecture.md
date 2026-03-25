# Arquitetura de informacao

## Rotas institucionais

### Fluxo base

- `/`: visao institucional e direcionamento do produto
- `/triagem`: captura de contexto antes do ticket
- `/ticket`: contrato do protocolo
- `/chat-ia`: atendimento assistido
- `/handoff`: escalacao humana
- `/integracoes`: governanca, estrutura e dependencias

### Aluno

- `/aluno`: home do atendimento
- `/aluno/solicitacoes`: protocolos, pendencias e notificacoes

### OP

- `/op/fila`: fila operacional
- `/op/playbook`: FAQ operacional

### Admin e gestao

- `/admin/dashboard`: dashboard geral
- `/admin/faq`: gestao da FAQ

## Componentes base

- `SectionPanel`: secao padrao para blocos de tela e documentacao
- `MetricCard`: card numerico para indicadores e status sinteticos
- `ActionTile`: card reutilizavel para listas de acao e catalogos
- `StatusBadge`: badge simples para estado, criticidade e revisao

## Regras desta fase

- backend real continua fora do escopo
- portal do atendimento e a fonte oficial da resposta
- e-mail e apenas notificacao
- integracao futura deve ficar concentrada em `src/services`
