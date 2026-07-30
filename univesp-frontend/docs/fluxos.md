# Fluxos principais

## Fluxo do aluno

1. usuario entra pelo Acesso Unificado
2. acessa o Sistema de Atendimento
3. escolhe um assunto na FAQ em arvore
4. o frontend registra o atendimento, mesmo quando a resposta da FAQ resolve
5. se a FAQ nao resolver, o usuario complementa com texto e anexos
6. o sistema gera protocolo
7. o caso sobe para a fila do OP
8. o aluno acompanha tudo pelo portal

## Fluxo do OP

1. OP acessa a fila operacional
2. prioriza por SLA, criticidade e tipo de assunto
3. abre o detalhe do atendimento
4. consulta a FAQ operacional ou playbook
5. responde ao aluno, pede complementacao ou escala
6. se escalar, envia contexto consolidado para area interna

## Fluxo da area interna

1. recebe o caso ja tratado pelo OP
2. atua como last mile
3. devolve orientacao final para o portal
4. mantem historico e auditoria do atendimento

## Fluxo de gestao e admin

1. acompanha dashboard geral e por area
2. monitora filas, SLA e casos criticos
3. governa FAQ do aluno e do OP
4. ajusta regras de criticidade, permissao e visibilidade
5. audita a trilha de atendimento

## Regras transversais

- resposta oficial sempre no portal
- e-mail apenas notifica mudanca ou pendencia
- todo atendimento deve ter registro
- todo escalonamento deve levar contexto anterior
