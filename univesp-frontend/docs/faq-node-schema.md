# FAQ Node Schema

## Estrutura configuravel da FAQ do aluno e da FAQ operacional do OP

## 1. Objetivo

Definir o modelo de dados canonico da FAQ para que a arvore:

- seja guiada
- seja configuravel sem codigo
- suporte importacao por planilha
- suporte multiplos niveis sem limite fixo
- permita versionamento e publicacao
- permita destaque dinamico por calendario academico
- sirva ao aluno e ao OP
- possa virar builder visual e no-code
- possa ser persistida no Frappe

---

## 2. Principio geral

A FAQ nao deve ser uma lista solta de perguntas.

Ela deve ser tratada como um pacote canonico versionado, composto por:

- `nodes`: conteudo e comportamento de cada no
- `links`: relacoes pai e filho da arvore
- `calendar_highlights`: regras sazonais de destaque e prioridade

Esse pacote deve ser o mesmo, independentemente de a manutencao acontecer por builder visual ou por planilha.

---

## 3. Modelo canonico da FAQ

O formato canonico recomendado para persistencia, importacao e exportacao e:

```json
{
  "schema_version": "2.0.0",
  "faq_id": "faq-aluno",
  "tipo_faq": "aluno",
  "metadata": {},
  "versioning": {},
  "publication": {},
  "nodes": [],
  "links": [],
  "calendar_highlights": []
}
```

### Campos de alto nivel

- `schema_version`: versao do schema tecnico
- `faq_id`: identificador estavel da FAQ
- `tipo_faq`: `aluno` ou `op`
- `metadata`: informacoes gerais da FAQ
- `versioning`: estado de versao atual
- `publication`: dados de publicacao e revisao
- `nodes`: lista canonica de nos
- `links`: lista canonica de relacoes pai e filho
- `calendar_highlights`: destaques sazonais por calendario

---

## 4. Estrutura base do no

Cada item de `nodes` deve conter, no minimo:

- `id`
- `tipo_faq`
- `perfil`
- `node_kind`
- `tema`
- `subtema`
- `titulo_exibido`
- `pergunta_exibida`
- `descricao_interna`
- `resposta`
- `acao`
- `abre_atendimento`
- `fila_destino`
- `criticidade_padrao`
- `sla_padrao`
- `ativo`
- `ordem`
- `permite_anexo`
- `campos_exigidos`
- `palavras_chave`
- `tags`
- `publication_status`
- `node_version`

### Campos recomendados

- `node_kind`: `theme`, `branch` ou `leaf`
- `destaque_home`: booleano para destaque base
- `prioridade_dinamica`: prioridade padrao antes da regra de calendario
- `builder_editable`: se o builder visual pode editar o no
- `spreadsheet_editable`: se o no pode ser mantido por planilha

### Observacao importante

No formato canonico, a hierarquia principal da arvore nao depende de `pai_id` nem de `filhos` dentro do no.

A hierarquia e definida pela aba e pela estrutura `links`, o que permite profundidade variavel sem limite fixo.

Campos como `pai_id` e `filhos` podem existir como derivacao de runtime ou exportacao auxiliar, mas nao devem ser a fonte de verdade da hierarquia.

---

## 5. Campos adicionais para FAQ do OP

Quando `tipo_faq = op`, incluir tambem:

- `checklist_op`
- `sistemas_a_consultar`
- `documentos_a_solicitar`
- `resposta_padrao_sugerida`
- `criterio_de_escalonamento`
- `motivo_escalonamento_sugerido`

### Uso esperado

- `checklist_op`: verificacoes obrigatorias antes da resposta
- `sistemas_a_consultar`: sistemas institucionais ou telas operacionais de apoio
- `documentos_a_solicitar`: evidencias minimas para continuidade
- `resposta_padrao_sugerida`: texto base para resposta oficial
- `criterio_de_escalonamento`: regra objetiva para subir o caso
- `motivo_escalonamento_sugerido`: classificacao padrao para historico e auditoria

---

## 6. Estrutura dos links

Cada item de `links` deve representar uma relacao pai e filho:

- `link_id`
- `faq_id`
- `parent_node_id`
- `child_node_id`
- `ordem`
- `ativo`

### Regras

- um no pode ter zero, um ou varios filhos
- um no filho deve ter apenas um pai ativo por versao, para manter o formato de arvore
- nos de topo nao aparecem como `child_node_id`
- a UI deve reconstruir a arvore recursivamente a partir de `nodes + links`

---

## 7. Destaques dinamicos por calendario

Cada item de `calendar_highlights` deve conter, no minimo:

- `highlight_id`
- `faq_id`
- `target_type`
- `target_id`
- `prioridade_dinamica`
- `janela_inicio`
- `janela_fim`
- `regra_de_calendario`
- `destaque_home`
- `ordem_dinamica`
- `badge_label`
- `ativo`

### Target suportado

- `node`
- `tema`
- `tag`

### Exemplos de periodo

- provas
- atividades_avaliativas
- matricula_rematricula
- estagio
- colacao
- enade

---

## 8. Versionamento e publicacao

O pacote da FAQ deve suportar:

- rascunho
- revisao
- publicado
- arquivado

### Campos recomendados em `versioning`

- `draft_version`
- `published_version`
- `publication_status`
- `change_summary`
- `import_source`
- `base_version`

### Campos recomendados em `publication`

- `can_publish`
- `last_published_at`
- `last_published_by`
- `next_review_at`

### Regra operacional

- toda importacao por planilha deve gerar uma nova versao de rascunho
- publicacao nao deve acontecer automaticamente no upload
- o builder visual deve editar a mesma estrutura canonica e tambem salvar como rascunho
- somente uma versao publicada por FAQ deve ficar ativa por vez

---

## 9. Modelo de importacao por planilha

O modelo de importacao recomendado deve ter pelo menos:

- aba `nodes`
- aba `links`
- aba `calendar_highlights` opcional

### Aba `nodes`

Colunas minimas sugeridas:

| coluna | uso |
| --- | --- |
| `node_id` | identificador unico do no |
| `faq_id` | faq alvo |
| `tipo_faq` | `aluno` ou `op` |
| `perfil` | perfil principal |
| `node_kind` | `theme`, `branch` ou `leaf` |
| `tema` | tema funcional |
| `subtema` | subtema funcional |
| `titulo_exibido` | titulo da arvore |
| `pergunta_exibida` | pergunta visivel |
| `descricao_interna` | contexto interno |
| `resposta` | resposta oficial |
| `acao` | acao final |
| `abre_atendimento` | booleano |
| `fila_destino` | fila padrao |
| `criticidade_padrao` | criticidade base |
| `sla_padrao` | SLA base |
| `ativo` | booleano |
| `ordem` | ordem padrao |
| `permite_anexo` | booleano |
| `campos_exigidos_json` | array em JSON |
| `palavras_chave_csv` | lista separada por virgula |
| `tags_csv` | lista separada por virgula |
| `publication_status` | draft, review, published ou archived |
| `node_version` | versao do no |

Colunas extras para OP:

| coluna | uso |
| --- | --- |
| `checklist_op_json` | checklist operacional |
| `sistemas_a_consultar_csv` | sistemas envolvidos |
| `documentos_a_solicitar_csv` | documentos esperados |
| `resposta_padrao_sugerida` | texto sugerido |
| `criterio_de_escalonamento` | regra de escalonamento |
| `motivo_escalonamento_sugerido` | motivo padrao |

### Aba `links`

Colunas minimas sugeridas:

| coluna | uso |
| --- | --- |
| `link_id` | identificador da ligacao |
| `faq_id` | faq alvo |
| `parent_node_id` | no pai |
| `child_node_id` | no filho |
| `ordem` | ordem entre irmaos |
| `ativo` | booleano |

### Aba `calendar_highlights`

Colunas minimas sugeridas:

| coluna | uso |
| --- | --- |
| `highlight_id` | identificador do destaque |
| `faq_id` | faq alvo |
| `target_type` | `node`, `tema` ou `tag` |
| `target_id` | id do no, tema ou tag |
| `prioridade_dinamica` | prioridade do periodo |
| `janela_inicio` | inicio da janela |
| `janela_fim` | fim da janela |
| `regra_de_calendario` | nome da regra |
| `destaque_home` | booleano |
| `ordem_dinamica` | ordem sazonal |
| `badge_label` | rotulo visual |
| `ativo` | booleano |

---

## 10. Como a importacao deve validar a planilha

Antes de aceitar a importacao, o sistema deve validar:

- ids duplicados em `nodes`
- ids duplicados em `links`
- `faq_id` inconsistente entre abas
- `parent_node_id` ou `child_node_id` inexistente
- ciclos na arvore
- um mesmo no com mais de um pai ativo na mesma versao
- acao invalida
- criticidade ou SLA fora do catalogo permitido
- `tipo_faq = op` sem colunas operacionais minimas quando obrigatorias
- `calendar_highlights` apontando para `target_id` inexistente
- datas invalidas ou janela invertida
- campos JSON malformados
- no folha sem resposta nem acao executavel

### Resultado da validacao

O sistema deve devolver:

- erros bloqueantes
- avisos nao bloqueantes
- resumo de linhas processadas
- preview da nova versao de rascunho

---

## 11. Builder visual e planilha no mesmo modelo

O builder visual e a planilha nao devem gerar modelos diferentes.

Ambos devem escrever no mesmo formato canonico:

- `nodes`
- `links`
- `calendar_highlights`

### Regra de convivencia

- planilha serve para carga em massa e manutencao operacional
- builder visual serve para edicao pontual, navegacao e governanca editorial
- exportacao do builder deve gerar as mesmas abas `nodes`, `links` e `calendar_highlights`
- importacao da planilha deve reconstruir o mesmo estado editavel no builder

---

## 12. Como a arvore suporta multiplos niveis

A arvore suporta profundidade variavel porque:

- o relacionamento e descrito em `links`
- um `child_node_id` pode ser pai de outros nos
- a UI reconstrui a estrutura de forma recursiva

Isso permite caminhos como:

- `matricula > rematricula > perda_de_prazo`
- `provas > segunda_chamada > motivo_medico > envio_de_atestado`
- `atividades_avaliativas > entrega > prazo_encerrado`
- `estagio > documentacao > termo_de_compromisso > assinatura`
- `colacao > diploma > prazo_de_emissao`

Nao existe limite fixo de nivel no schema. O limite passa a ser apenas de governanca editorial e usabilidade.

---

## 13. Exemplos reais de temas e caminhos

### Aluno

- Matricula: `matricula > rematricula > perdi_o_prazo`
- Provas: `provas > segunda_chamada > motivo_medico > envio_de_atestado`
- Atividades avaliativas: `atividades_avaliativas > entrega > prazo_encerrado`
- Estagio: `estagio > documentacao > termo_de_compromisso`
- Colacao: `colacao > diploma > prazo_de_emissao`

### OP

- Matricula: `matricula > rematricula > validar_perda_de_prazo`
- Provas: `provas > segunda_chamada > validar_atestado`
- Atividades avaliativas: `atividades_avaliativas > prazo_encerrado > validar_excecao`
- Estagio: `estagio > termo_de_compromisso > validar_documentacao`
- Colacao: `colacao > diploma > validar_previsao`

---

## 14. Exemplo conceitual de importacao

### Exemplo de linha da aba `nodes`

| node_id | tipo_faq | node_kind | tema | subtema | titulo_exibido | acao | fila_destino |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `faq-aluno-rematricula-perda-prazo` | `aluno` | `leaf` | `matricula` | `perda_de_prazo` | `Perdi o prazo de rematricula` | `abrir_atendimento` | `sra` |

### Exemplo de linha da aba `links`

| link_id | parent_node_id | child_node_id | ordem |
| --- | --- | --- | --- |
| `lnk-001` | `faq-aluno-tema-matricula` | `faq-aluno-ramo-rematricula` | `1` |

### Exemplo de linha da aba `calendar_highlights`

| highlight_id | target_type | target_id | regra_de_calendario | destaque_home |
| --- | --- | --- | --- | --- |
| `hl-001` | `tema` | `provas` | `periodo_provas` | `true` |

---

## 15. Resultado esperado

Este schema deve permitir que a FAQ:

- funcione como arvore guiada para aluno e OP
- seja importada e exportada por planilha
- seja mantida tambem por builder visual
- suporte multiplos niveis sem limite fixo
- seja versionada e publicada com seguranca
- reordene temas por calendario academico
- sirva de base para persistencia futura no Frappe sem reescrever a UI
