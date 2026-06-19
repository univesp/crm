# SDD - Logica Academica Fase 2

## Proposito

Definir a direcao de sistema para respostas academicas calculadas no CRM UNIVESP.

O objetivo e permitir que o aluno receba respostas mais assertivas quando a pergunta depender de dados oficiais, como disciplinas pendentes, situacao de matricula, equivalencias, pendencias documentais ou elegibilidade academica.

## Fronteira

Esta fase nao muda o MVP atual de atendimento, FAQ e protocolo. Ela prepara a arquitetura para que, no futuro, uma resposta final da FAQ possa chamar um motor academico.

## Decisao arquitetural

- Vue continua sendo camada de experiencia.
- Frappe continua sendo camada de atendimento, protocolo, workflow e auditoria.
- A logica academica deve ficar em backend/API/motor de dominio.
- A fonte oficial dos dados academicos deve ser API institucional ou replica controlada.
- IA pode ajudar a classificar intencao e explicar o resultado, mas nao pode inventar resposta academica.

## Fluxo alvo

```text
Aluno pergunta
  -> FAQ identifica intencao
  -> CRM valida sessao
  -> backend valida permissao
  -> motor academico consulta dados oficiais
  -> regra deterministica calcula resultado
  -> CRM exibe resposta explicavel
  -> incerteza abre protocolo ou encaminha area
```

## Preparacao ja aplicada no MVP

O FAQ Builder passa a aceitar metadados de fase 2 nos finais de fluxo:

- `response_mode`;
- `academic_intent`;
- `data_contract_key`;
- `confidence_policy`.

Esses campos nao executam consulta academica no MVP. Eles apenas documentam e versionam quais respostas poderao depender de dados oficiais no futuro.

## Regras de produto

- Resposta automatica so deve aparecer quando o calculo for deterministico.
- Resposta parcial deve declarar a incerteza.
- Quando houver conflito de dados, abrir protocolo.
- O aluno deve ver o resultado e o motivo, nao a mecanica interna.
- OP/area deve ver a base usada para orientar, com auditoria.

## Regras de seguranca

- O frontend nao envia RA arbitrario para consultar outro aluno.
- Permissao e escopo sao validados no servidor.
- Consulta academica sensivel gera evento de auditoria.
- Historico academico completo nao deve ser duplicado no protocolo sem necessidade.
- Dados exibidos devem ser minimizados conforme LGPD.

## Specs

A especificacao tecnica da fase fica em `docs/SPECS_ACADEMIC_LOGIC_PHASE2.md`.
