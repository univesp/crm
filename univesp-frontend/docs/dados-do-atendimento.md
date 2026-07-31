# Dados do atendimento

## Entidades principais

### Usuario logado

- id
- nome
- email
- RA
- perfil
- curso
- polo
- origem de autenticacao

### Registro de atendimento

- id do registro
- data e hora
- canal
- origem do fluxo
- categoria selecionada
- resposta exibida
- resultado do fluxo

### Protocolo

- numero
- assunto
- descricao
- status
- criticidade
- SLA
- fila atual
- historico

### FAQ

- id
- categoria
- titulo
- conteudo
- palavras-chave
- status de publicacao

### Fila operacional

- protocolo
- aluno
- assunto
- status
- criticidade
- SLA
- operador responsavel

## Observacoes

- os nomes finais de campos dependem do backend
- nesta fase a estrutura serve para mocks e alinhamento funcional
