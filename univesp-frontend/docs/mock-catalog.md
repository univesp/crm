# Catalogo de mocks

## Objetivo

Centralizar os dados de produto da fase atual em `mocks/`, para evitar espalhar estado fake nos componentes visuais.

## Arquivos

### `mocks/personas.js`

- personas de aluno, OP e admin
- jornadas resumidas por perfil

### `mocks/journey.js`

- sessao de referencia
- aluno autenticado
- respostas default da triagem

### `mocks/knowledgeBase.js`

- FAQ em arvore do aluno
- FAQ operacional do OP
- snapshot de governanca da FAQ

### `mocks/faq-aluno.json`

- formato canonico da FAQ do aluno
- usa `nodes`, `links` e `calendar_highlights`
- cobre versionamento, publicacao e destaque por calendario

### `mocks/faq-op.json`

- formato canonico da FAQ operacional do OP
- inclui campos operacionais extras
- usa o mesmo modelo de importacao por planilha e builder visual

### `mocks/faq-import-nodes.csv`

- planilha de exemplo para a aba `nodes`
- representa a FAQ do aluno em formato de importacao
- cobre matricula, provas, atividades avaliativas, estagio e colacao

### `mocks/faq-import-links.csv`

- planilha de exemplo para a aba `links`
- reconstrui a hierarquia pai-filho sem limite fixo de profundidade

### `mocks/faq-import-calendar-highlights.csv`

- planilha de exemplo para a aba `calendar_highlights`
- cobre destaque dinamico por calendario academico

### `mocks/operations.js`

- acoes rapidas do aluno
- protocolos e notificacoes
- fila operacional do OP
- cards de governanca e dashboard admin
- filas mockadas para documentacao estrutural
