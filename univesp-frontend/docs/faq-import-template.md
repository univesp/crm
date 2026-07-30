# FAQ Import Template

## Objetivo

Definir o modelo minimo de planilha para importar uma FAQ canonica sem depender de backend real.

Nesta fase, a importacao deve continuar gerando o mesmo pacote logico usado pelo frontend:

- `nodes`
- `links`
- `calendar_highlights`

O workbook deve representar uma unica FAQ por vez, por exemplo `faq-aluno` ou `faq-op`.

---

## Estrutura recomendada do workbook

### Aba `nodes`

Fonte de verdade do conteudo e do comportamento de cada no.

Colunas obrigatorias:

| coluna | uso |
| --- | --- |
| `node_id` | identificador estavel do no |
| `faq_id` | FAQ alvo da importacao |
| `tipo_faq` | tipo tecnico da FAQ |
| `perfil` | perfil principal visivel |
| `node_kind` | tipo tecnico do no |
| `tema` | tema principal |
| `subtema` | subtema funcional |
| `titulo_exibido` | titulo visivel na arvore |
| `pergunta_exibida` | pergunta exibida ao usuario |
| `descricao_interna` | contexto interno/editorial |
| `resposta` | resposta oficial ou resumo do ramo |
| `acao` | comportamento final do no |
| `abre_atendimento` | indica se o no abre registro/protocolo |
| `fila_destino` | fila padrao sugerida |
| `criticidade_padrao` | criticidade base |
| `sla_padrao` | SLA base |
| `ativo` | indica se o no esta ativo |
| `ordem` | ordem padrao entre irmaos |
| `permite_anexo` | habilita anexos no fluxo |
| `campos_exigidos_json` | array JSON com campos obrigatorios |
| `palavras_chave_csv` | lista separada por virgula |
| `tags_csv` | lista separada por virgula |
| `publication_status` | estado editorial do no |
| `node_version` | versao tecnica/editorial do no |

Colunas extras para FAQ do OP:

| coluna | uso |
| --- | --- |
| `checklist_op_json` | checklist operacional |
| `sistemas_a_consultar_csv` | sistemas/telas de apoio |
| `documentos_a_solicitar_csv` | documentos e evidencias esperadas |
| `resposta_padrao_sugerida` | resposta sugerida para o portal |
| `criterio_de_escalonamento` | gatilho objetivo para escalar |
| `motivo_escalonamento_sugerido` | motivo padrao para auditoria |

### Aba `links`

Fonte de verdade da hierarquia.

Colunas obrigatorias:

| coluna | uso |
| --- | --- |
| `link_id` | identificador da ligacao |
| `faq_id` | FAQ alvo da importacao |
| `parent_node_id` | no pai |
| `child_node_id` | no filho |
| `ordem` | ordem entre filhos do mesmo pai |
| `ativo` | indica se a ligacao esta ativa |

### Aba `calendar_highlights`

Opcional. Reordena e destaca temas conforme o periodo academico.

Colunas obrigatorias:

| coluna | uso |
| --- | --- |
| `highlight_id` | identificador do destaque |
| `faq_id` | FAQ alvo da importacao |
| `target_type` | tipo de alvo: no, tema ou tag |
| `target_id` | id do no, nome do tema ou tag |
| `prioridade_dinamica` | prioridade do periodo |
| `janela_inicio` | data inicial da regra |
| `janela_fim` | data final da regra |
| `regra_de_calendario` | nome interno da regra |
| `destaque_home` | indica destaque na home |
| `ordem_dinamica` | ordem sazonal do item |
| `badge_label` | rotulo visual do destaque |
| `ativo` | indica se a regra esta ativa |

---

## Parametros fora da planilha

O upload deve receber tambem, pela tela de importacao ou modal de governanca:

- `faq_id`
- `draft_version`
- `base_version`
- `change_summary`
- `import_source`

Esses dados alimentam `versioning` e `publication`, enquanto as abas alimentam `nodes`, `links` e `calendar_highlights`.

---

## Regras de validacao

Antes de aceitar o workbook, o sistema deve validar:

- `faq_id` consistente em todas as abas
- ids unicos em `nodes`, `links` e `calendar_highlights`
- valores de enum dentro dos catalogos oficiais
- `parent_node_id` e `child_node_id` existentes
- ausencia de ciclos
- um unico pai ativo por no na mesma versao
- `node_kind = leaf` com resposta ou acao terminal valida
- datas validas e janela nao invertida
- campos JSON validos em `campos_exigidos_json` e `checklist_op_json`
- `target_type` e `target_id` coerentes com a FAQ

O resultado minimo da validacao deve devolver:

- erros bloqueantes
- avisos nao bloqueantes
- total de linhas processadas por aba
- preview da nova versao de rascunho

---

## Convivencia entre builder visual e planilha

Builder visual e planilha devem editar o mesmo modelo canonico.

Regra operacional:

- planilha e o canal de carga em massa
- builder visual e o canal de manutencao editorial e navegacao
- exportacao do builder deve gerar as mesmas tres abas
- importacao da planilha deve reconstruir o mesmo estado editavel no builder

---

## Arquivos de exemplo desta fase

Os exemplos desta etapa representam a importacao da FAQ do aluno:

- `mocks/faq-import-nodes.csv`
- `mocks/faq-import-links.csv`
- `mocks/faq-import-calendar-highlights.csv`

Eles usam os temas:

- matricula
- provas
- atividades_avaliativas
- estagio
- colacao

---

## Resultado esperado

Ao fim da importacao, o frontend deve conseguir:

- validar os dados sem backend real
- montar a arvore a partir de `nodes + links`
- aplicar destaque dinamico por `calendar_highlights`
- manter rascunho e publicacao sem reescrever a UI
