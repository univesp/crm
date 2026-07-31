# Plano de Migracao de Layout, Marca e Acessibilidade

## Decisao

Antes de remover todos os hardcodeds de layout, o CRM deve passar por uma migracao planejada. O volume atual e alto o bastante para exigir fases curtas, validação visual por perfil e rollback simples.

Este plano complementa:

- `docs/DESIGN.md`
- `univesp-frontend/docs/design-system-univesp.md`
- `docs/UX_PRINCIPLES_CRM.md`

Referencias externas adotadas:

- Guia de Matricula Univesp: `https://guiamatricula.univesp.br/`
- WCAG 2.2 W3C: `https://www.w3.org/TR/WCAG22/`
- WAI/WCAG Quick Reference: `https://www.w3.org/WAI/WCAG22/quickref/`
- WAI Easy Checks: `https://www.w3.org/WAI/test-evaluate/preliminary/`

## Inventario atual

Leitura feita em `univesp-frontend/src`:

| Padrao | Ocorrencias | Risco |
| --- | ---: | --- |
| `rounded-[...]` | 614 | Raio visual inconsistente e dificil de manter |
| `shadow-[...]` | 26 | Sombra por tela, sem criterio institucional unico |
| Roxo legado `109,76,255` | 18 | Quebra da identidade Univesp baseada no vermelho institucional |
| `blur-3xl` decorativo | 3 | Ruido visual e custo cognitivo sem ganho operacional |
| `tracking-[...]` | 154 | Risco de legibilidade e excesso de caixa alta |
| `hover:-translate-y` | 14 | Movimento decorativo em tela operacional |
| `<img` | 2 | Marca hoje depende de imagem remota em login/acesso local |
| `aria-*` | 151 | Boa base, mas precisa auditoria de consistencia |
| `role=` | 73 | Boa base, mas precisa validar uso semantico |
| `tabindex` | 4 | Baixo volume, revisar foco programatico |

Arquivos com maior impacto visual:

- `univesp-frontend/src/App.vue`
- `univesp-frontend/src/components/AppSidebar.vue`
- `univesp-frontend/src/components/FaqTopicCard.vue`
- `univesp-frontend/src/components/student/StudentStageLayout.vue`
- `univesp-frontend/src/pages/student/*`
- `univesp-frontend/src/pages/operator/*`
- `univesp-frontend/src/pages/area/*`
- `univesp-frontend/src/pages/admin/*`
- `univesp-frontend/src/pages/LoginPage.vue`
- `univesp-frontend/src/pages/LocalAccessPage.vue`

## Objetivo final

Eliminar overrides globais como solucao permanente e mover o layout para:

- tokens CSS institucionais;
- componentes base reutilizaveis;
- classes semanticas do produto;
- assets oficiais versionados localmente;
- verificacao de acessibilidade por fluxo critico.

O resultado precisa ser simples, leve e intuitivo. A tela nao deve parecer uma demonstracao de construcao do sistema, wireframe, blueprint ou documentacao tecnica. O usuario final deve ver apenas orientacao, estado, proximo passo e acao possivel.

O padrao visual deve seguir a linha do Guia de Matricula Univesp: institucional, claro, com marca real, tipografia Open Sans/Barlow, superficies simples e sem excesso de decoracao.

## Fase 0 - Direcao congelada

### Escopo

- Adotar `docs/DESIGN.md` como diretriz local canonica do CRM.
- Usar `https://guiamatricula.univesp.br/` como referencia visual institucional.
- Usar WCAG 2.2 nivel AA como alvo tecnico principal.
- Registrar dark mode, alto contraste, zoom e leitura para dislexia como requisitos de design, nao como ajustes finais.
- Separar interface final de artefatos de construcao, prototipo ou blueprint.

### Criterio de pronto

- Documentacao aponta fonte visual e norma de acessibilidade.
- Assets oficiais Univesp versionados no frontend.
- Base CSS contem tokens e classes iniciais para migracao.

## Principio de simplificacao

Remover da interface final tudo que existe apenas para explicar a construcao interna do produto:

- textos de apoio que descrevem a arquitetura da tela;
- labels como `apoio`, `shell`, `blueprint`, `contexto local`, `modo local`, `jornada`, quando nao forem acao ou informacao util ao usuario final;
- cards laterais que repetem o que a tela principal ja comunica;
- microcopy de prototipo, exemplo ou demonstracao;
- elementos visuais decorativos que nao ajudam a decisao;
- excesso de bordas, chips, sombras, caixas e subtitulos concorrentes.

Exemplo observado: o card lateral com `APOIO / Portal oficial / Primeiro mostramos a orientacao oficial...` deve ser tratado como artefato de construcao. Em producao, isso deve virar uma orientacao direta dentro do fluxo, ou desaparecer se nao acrescentar decisao ao aluno.

Diretriz: se o texto explica como o sistema foi desenhado, remover; se orienta o usuario sobre o que fazer agora, manter e simplificar.

## Fase 1 - Fundacao visual sem hardcoded

### Escopo

Criar ou consolidar classes base no `index.css`:

- `.crm-shell`
- `.crm-page`
- `.crm-page-header`
- `.crm-panel`
- `.crm-card`
- `.crm-card-muted`
- `.crm-button-primary`
- `.crm-button-secondary`
- `.crm-chip`
- `.crm-field`
- `.crm-state-success`
- `.crm-state-warning`
- `.crm-state-danger`
- `.crm-state-info`
- `.crm-brand-mark`
- `.a11y-readable`
- `.a11y-dyslexia`
- `.a11y-zoom-lg`
- `.a11y-zoom-xl`
- `.a11y-high-contrast`

### Ajustes

- Remover dependência de `rounded-[...]` em componentes compartilhados.
- Trocar sombras arbitrarias por `--shadow-sm`, `--shadow-md` ou nenhuma sombra.
- Remover gradientes e blobs decorativos dos shells principais.
- Manter `rounded-full` apenas para elementos que realmente sejam circulares ou pills pequenos.
- Criar tokens para light/dark mode.
- Garantir que componentes base suportem zoom 200% sem largura fixa fragil.
- Evitar `letter-spacing` excessivo e texto justificado.
- Preparar classe de leitura ampliada para pessoas com dislexia ou baixa visao.

### Arquivos provaveis

- `univesp-frontend/src/index.css`
- `univesp-frontend/src/components/SectionPanel.vue`
- `univesp-frontend/src/components/MetricCard.vue`
- `univesp-frontend/src/components/StatusBadge.vue`
- `univesp-frontend/src/components/SlaBadge.vue`
- `univesp-frontend/src/components/PriorityBadge.vue`

## Fase 2 - Shell institucional publico

### Escopo

Implantar nas telas publicas/de entrada:

- link de pulo para conteudo;
- barra Gov SP simplificada;
- marca Univesp local;
- rodape institucional base;
- controles iniciais de acessibilidade: aumentar texto, diminuir texto, alto contraste, fonte legivel e redefinir;
- tokens `--crm-*` como aliases estaveis para os tokens existentes.

Versionar assets oficiais em:

- `univesp-frontend/public/brand/`;
- `univesp-frontend/public/brand/gov/`.

Assets desejados:

- logo Univesp simplificado positivo;
- logo Univesp completo positivo, se aprovado para rodape ou telas institucionais;
- favicon conforme orientacao da Comunicacao;
- arquivo de referencia/README de origem dos assets.

### Regras

- Nao substituir a marca por texto `UNIVESP` quando houver espaco para logo.
- Nao usar simbolo isolado como assinatura principal.
- Evitar depender de `https://apps.univesp.br/common/colorida-positiva.svg` em runtime de producao.
- Manter `alt` significativo em imagem de marca, exceto quando redundante com texto vizinho.
- Nao exibir textos de construcao do sistema nas telas publicas.
- Manter controles acessiveis por teclado e com nomes compreensiveis para leitor de tela.

### Telas iniciais

- `univesp-frontend/src/pages/LoginPage.vue`
- `univesp-frontend/src/pages/LocalAccessPage.vue`

### Resultado esperado

- Login e acesso local usam o mesmo shell institucional.
- A marca deixa de depender de URL remota em runtime.
- O usuario encontra conteudo principal, acessibilidade e rodape de forma previsivel.
- O visual fica simples, leve, sem blobs, gradientes decorativos ou cards de explicacao interna.

### Icones de interface

- Padronizar icones de acao com biblioteca unica ou classe unica.
- Icones decorativos devem ter `aria-hidden="true"`.
- Icones que sao o unico conteudo de botao precisam de nome acessivel (`aria-label`).
- Evitar misturar Material Symbols, texto solto e icones custom sem criterio.

## Fase 3 - Aluno

Status: aplicada como migracao visual inicial.

### Escopo

Remover hardcoded diretamente das telas:

- `StudentStageLayout.vue`
- `StudentHomePage.vue`
- `StudentJourneyPage.vue`
- `StudentProtocolPage.vue`
- `StudentRequestsPage.vue`
- `StudentRequestDetailPage.vue`
- `StudentConfirmationPage.vue`

### Ajustes prioritarios

- Trocar roxo legado por tokens institucionais.
- Substituir cards por `.crm-card` e `.crm-card-muted`.
- Garantir uma acao primaria por bloco.
- Garantir que busca, abrir protocolo e acompanhar solicitacao tenham labels e mensagens recuperaveis.
- Validar mobile primeiro, porque aluno tende a acessar pelo celular.
- Remover textos e cards que expliquem a construcao da jornada em vez de orientar o aluno.
- Reduzir colunas laterais quando forem apenas apoio editorial; no desktop, manter lateral apenas se trouxer resumo acionavel ou estado real.
- Preferir frases curtas: estado, proximo passo, prazo/canal.

### Resultado esperado

- Aluno entende: estado atual, proximo passo, prazo esperado e canal correto.
- Nenhuma tela depende de hover para revelar conteudo importante.
- Sem texto longo em vermelho.
- Shell do aluno sem coluna de apoio artificial, sem roxo legado, sem blobs e sem artefatos de debug/prototipo.
- Rotas e fluxo permanecem inalterados; a migracao foi limitada a layout, texto visivel e classes visuais.

## Fase 4 - OP e secretario

Status: aplicada como padronizacao visual inicial.

### Escopo

Remover hardcoded diretamente das telas:

- `OperatorQueuePage.vue`
- `OperatorCaseDetailPage.vue`
- `OperatorGuidancePage.vue`
- `OperatorPlaybookPage.vue`

### Ajustes prioritarios

- Densidade maior que aluno, mas com hierarquia clara.
- Filtros e fila com componentes consistentes.
- Acoes de triagem com uma primaria por contexto.
- Estados de SLA, prioridade e criticidade usando badges existentes.
- Painel lateral e detalhe do caso sem excesso de cards aninhados.
- Remover textos que expliquem o prototipo ou a mecanica interna do fluxo.
- Manter informacao operacional que ajuda a decidir: responsavel, regra, SLA, historico e proxima acao.

### Resultado esperado

- OP decide rapido se orienta, resolve localmente, encaminha ou escala.
- Reduz cliques e evita ambiguidade operacional.
- Telas operacionais sem hover de deslocamento, sem sombras arbitrarias e com raios padronizados.
- Contratos, acoes, filtros, filas e decisao operacional permanecem inalterados.

## Fase 5 - Area, gestor e admin

Status: aplicada como padronizacao visual inicial.

### Escopo

Depois de Aluno e OP, aplicar a mesma limpeza em:

- `univesp-frontend/src/pages/area/*`
- `univesp-frontend/src/pages/admin/*`
- `FaqCanvasNode.vue`
- telas gerais de triagem, ticket, handoff e integracoes.

### Resultado esperado

- Gestor atua por excecao.
- Admin/FAQ Builder continua poderoso, mas com progressividade e baixa carga cognitiva.
- Governanca visual fica consistente com aluno e OP.
- Area, gestor e admin usam padrao visual mais contido: menos raio, menos sombra, sem letter-spacing excessivo e sem decoracao global.
- Regras, rotas, permissao, publicacao, filas e integracoes permanecem inalteradas.

## Acessibilidade

### Checklist por tela

- Ordem de foco segue a leitura visual.
- Todo botao icon-only tem nome acessivel.
- Todo input/select/textarea tem label ou `aria-label` adequado.
- Mensagens de erro usam `role="alert"` ou `aria-live` quando precisam ser anunciadas.
- Regioes expansivas usam `aria-expanded` e `aria-controls` de forma consistente.
- Contraste atende WCAG AA.
- Texto nao depende de cor como unico indicador.
- Zoom de 200% nao quebra fluxo principal.
- Zoom reduzido nao torna textos ilegiveis ou botoes pequenos demais.
- Dark mode preserva contraste, foco e estados semanticos.
- Modo de leitura/dilexia aumenta espacamento sem quebrar cards ou tabelas.
- Mobile nao esconde acao primaria.

### Validacao tecnica sugerida

- Build.
- ESLint escopado nos arquivos alterados.
- Varredura por hardcoded restante:
  - `rounded-[`
  - `shadow-[`
  - `109,76,255`
  - `blur-3xl`
  - `tracking-[`
  - `hover:-translate-y`
- Browser local em desktop e mobile para:
  - `/crm/acesso-local/aluno`
  - `/crm/acesso-local/op`
  - `/crm/aluno`
  - `/crm/aluno/solicitacoes`
  - `/crm/aluno/protocolo`
  - `/crm/op/fila`
  - `/crm/op/playbook`

## Ordem recomendada de implementacao

1. Versionar marca oficial e criar `public/brand/README.md`.
2. Criar classes base definitivas em `index.css`.
3. Migrar componentes compartilhados.
4. Migrar telas do aluno.
5. Migrar telas do OP.
6. Remover overrides temporarios de `.shell-student` e `.shell-operational`.
7. Rodar auditoria visual e acessibilidade.
8. Aplicar o mesmo padrao em area, gestor e admin.

## Criterio de pronto

- Nenhum fluxo critico depende de overrides globais para parecer institucional.
- Hardcoded visual reduzido aos casos justificaveis.
- Logo/icone institucional versionado localmente.
- Acessibilidade validada em teclado, foco, labels, contraste e responsividade.
- `git diff --stat` e `git status --short` registrados na entrega.
