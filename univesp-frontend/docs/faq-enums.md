# FAQ Enums

## Objetivo

Centralizar os catalogos oficiais usados pela FAQ canonica do aluno e do OP.

Os nomes abaixo sao os catalogos de referencia. No payload atual, eles se ligam aos seguintes campos tecnicos:

| catalogo oficial | campo tecnico atual |
| --- | --- |
| `action` | `acao` |
| `criticality` | `criticidade_padrao` |
| `sla` | `sla_padrao` |
| `faq_type` | `tipo_faq` |
| `node_type` | `node_kind` |
| `queue_destination` | `fila_destino` |

---

## `action`

| valor | uso esperado |
| --- | --- |
| `mostrar_resposta` | exibe resposta e encerra a navegacao guiada |
| `ir_para_subniveis` | continua a arvore para os proximos niveis |
| `abrir_atendimento` | gera registro e abre protocolo sem exigir anexo |
| `abrir_atendimento_com_anexo` | gera registro e abre protocolo com anexo habilitado |
| `encerrar_com_registro` | registra a passagem da FAQ sem abrir protocolo humano |
| `encaminhar_para_op` | envia o caso para fila operacional do OP |
| `encaminhar_para_area` | envia o caso para area interna ou fila especializada |
| `solicitar_documento` | abre continuidade condicionada ao envio de documento |

---

## `criticality`

| valor | uso esperado |
| --- | --- |
| `baixa` | fluxo informativo sem risco imediato |
| `media` | caso regular com impacto controlado |
| `alta` | caso prioritario com risco academico relevante |
| `critica` | caso urgente com risco de prazo ou impacto institucional alto |

---

## `sla`

| valor | uso esperado |
| --- | --- |
| `4h` | contingencia ou janela critica |
| `8h` | fila muito prioritaria |
| `24h` | tema academico urgente |
| `48h` | atendimento padrao com prioridade media |
| `72h` | atendimento padrao com baixa urgencia |

---

## `faq_type`

| valor | uso esperado |
| --- | --- |
| `aluno` | FAQ institucional guiada para aluno ou ex-aluno |
| `op` | FAQ operacional usada pelo OP antes do escalonamento |

---

## `node_type`

| valor | uso esperado |
| --- | --- |
| `theme` | tema principal exibido na entrada da FAQ |
| `branch` | nivel intermediario de decisao |
| `leaf` | no terminal com resposta, protocolo ou escalonamento |

---

## `queue_destination`

Catalogo oficial da fase atual:

| valor | uso esperado |
| --- | --- |
| `nao_aplicavel` | no sem encaminhamento de fila |
| `op` | fila operacional do Operador de Polo |
| `sra` | secretaria e registro academico |
| `suporte_academico_digital` | provas, AVA e apoio academico digital |

Novas filas devem entrar por governanca editorial e atualizar este catalogo antes de serem usadas em planilha ou builder.
