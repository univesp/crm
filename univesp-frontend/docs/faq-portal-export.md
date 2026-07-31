# Exportacao de FAQ para portal externo

## Objetivo

Permitir que o FAQ Builder gere manualmente um artefato JSON enxuto para revisao e publicacao externa no Portal de Matricula, sem alterar o fluxo de publicacao do CRM.

## Regras

- A exportacao parte sempre do `draftBundle` atual selecionado.
- A exportacao nao publica nada no CRM.
- O portal externo nao consome o CRM em runtime e nao depende de `localStorage`, `draftBundle` ou `publishedBundle`.
- `process`, `audience`, `version` e rotas de acoes sao preenchidos manualmente no painel avancado de exportacao.
- `version` pode ficar vazia; nesse caso o artefato recebe fallback `draft-YYYYMMDD-HHmm`.
- `primaryAction` e `secondaryActions` sao opcionais. Quando algum campo de uma acao for preenchido, `label` e `route` passam a ser obrigatorios.
- Rotas aceitas devem ser relativas ao portal externo, comecar por `/`, nao apontar para dominio externo e nao usar rotas internas do CRM.

## Contrato `portal-faq-export-v1`

Campos de topo:

- `schemaVersion`
- `exportId`
- `faqTitle`
- `sourceBundleId`
- `exportedAt`
- `exportedFrom`
- `version`
- `audience`
- `process`
- `checksum` quando disponivel
- `primaryAction` opcional
- `secondaryActions` opcional
- `items`

`items` contem a arvore pronta para renderizacao no portal:

- `section`: no de caminho com `children`
- `answer`: no terminal com `answer`

Campos editoriais internos, governanca de publicacao, ownership operacional e snapshot de canvas nao fazem parte do artefato exportado.

## Validacao minima

Antes do download, a exportacao bloqueia quando houver:

- nos orfaos
- ciclos
- resposta terminal vazia
- IDs duplicados
- `process` ausente
- `audience` invalido
- `version` ausente
- acao principal incompleta ou rota invalida

## Fluxo esperado

1. Criar ou editar o fluxo no FAQ Builder.
2. Preencher o painel avancado de exportacao.
3. Validar e baixar o JSON.
4. Revisar o arquivo no repositorio do Portal de Matricula.
5. Versionar, homologar e publicar pelo fluxo proprio do portal externo.
