# Lacunas, riscos e pontos para validacao

## 1) Gaps documentais e de evidencia

1. Nao ha print dedicado para:
`/aluno/confirmacao/:protocolId` e `/wireframes/aluno/:screenId?`.
2. Algumas telas institucionais sao blueprint e podem ser interpretadas como produto final se nao rotuladas.
3. Nem todo fluxo de erro esta documentado visualmente (ex.: caso fora de escopo na area).

## 2) Trechos com aparencia de mock/conceitual

1. Modulo institucional (`/triagem`, `/ticket`, `/handoff`, `/integracoes`) e fortemente demonstrativo.
2. Persistencia principal ainda em `Pinia + localStorage`.
3. Parte dos dados administrativos e de operacao e simulada a partir de mocks do repositorio.

## 3) Fluxos nao totalmente fechados

1. Integracao real de submissao/atualizacao de caso com API canonica.
2. Concorrencia de distribuicao e assignment simultaneo em alto volume.
3. Reconciliacao transacional entre publicacao de conhecimento e uso imediato em fila ativa.

## 4) Inconsistencias de nomenclatura

1. coexistencia de termos:
`caso`, `atendimento`, `solicitacao`, `protocolo`.
2. em alguns pontos, labels com encoding inconsistente (ex.: "canÃ´nico").

## 5) Riscos de UX confusa

1. Estado vazio/erro no detalhe da area sem mensagem orientativa.
2. Densidade textual alta em detalhe do analista.
3. Gestor de polos ainda com experiencia muito parecida com OP.

## 6) Riscos operacionais

1. Escalonamento precoce se criterios nao forem bloqueados em backend.
2. Configuracao de regra de escopo/disponibilidade sem simulacao de impacto.
3. Concluir analise sem resposta final obrigatoria pode quebrar compromisso com aluno.

## 7) Riscos de escala (10k-20k protocolos)

1. lista de fila sem estrategia confirmada de paginacao server-side.
2. possivel re-render pesado em detalhes com timeline extensa.
3. filtros/client-side podem degradar com volume real se nao migrados para query backend.

## 8) Dependencias ocultas

1. qualidade da distribuicao depende fortemente de cadastro de disponibilidade/elegibilidade.
2. governanca funcional depende de dados canonicos unificados entre modulos.
3. SSO e contrato de sessao ainda dependem de infraestrutura externa nao exercitada ponta a ponta nesta rodada.

## 9) Fragilidades de governanca

1. admin concentra muitas alavancas criticas sem trilha formal de aprovacao em dupla.
2. parametros (SLA/criticidade) sem versionamento dedicado equivalente ao conhecimento.
3. risco de "edicao manual intensa" em FAQ/permissao em cenario de alta mudanca.

## 10) Fragilidades de parametrizacao

1. regras complexas podem ser configuradas incorretamente sem validadores de conflito.
2. falta simulacao de impacto antes de salvar regra de escopo.
3. falta "modo seguro" de rollback rapido.

## 11) Pontos que podem comprometer adocao

1. se analista abrir casos em branco, confianca operacional cai rapidamente.
2. se aluno nao receber resposta final consistente, percepcao de valor cai.
3. se gestor nao confiar nos KPIs, operacao volta para controles paralelos (planilha/whatsapp/email).

## 12) Prioridade de validacao para especialista externo

## Bloqueadores potenciais

1. comportamento de abertura de caso da area em todos os cenarios de URL/escopo.
2. regra obrigatoria de resposta final antes de conclusao.
3. contrato backend para snapshots/auditoria como fonte oficial.

## Riscos altos

1. estrategia de performance para volume real de fila.
2. modelo de permissao server-side alinhado ao frontend.
3. estrategia de rollback de configuracoes administrativas.

## Riscos medios

1. consistencia de nomenclatura na experiencia.
2. simplificacao do editor de FAQ para nao tecnicos.
3. diferenciacao adicional de gestor de polos.

