# Status e regras do atendimento

## Status sugeridos

- registrado_por_faq
- protocolo_aberto
- aguardando_acao_op
- aguardando_complementacao_aluno
- em_analise_area_interna
- respondido_no_portal
- concluido
- cancelado

## Criticidade sugerida

- baixa
- media
- alta
- critica

## Regras de transicao

- FAQ resolvida gera `registrado_por_faq`
- continuidade com texto ou anexo gera `protocolo_aberto`
- protocolo novo entra em `aguardando_acao_op`
- pedido de evidencias muda para `aguardando_complementacao_aluno`
- escalonamento muda para `em_analise_area_interna`
- resposta formal no portal muda para `respondido_no_portal`
- encerramento muda para `concluido`

## Regras gerais

- um protocolo nao deve perder contexto ao trocar de fila
- toda mudanca de status deve gerar historico
- SLA e criticidade devem ficar visiveis para OP e gestao
- notificacao por e-mail nao substitui a leitura do portal
