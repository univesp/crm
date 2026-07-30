# Module Architecture

## Sistema de Atendimento da Univesp

## 1. Objetivo

Definir como o frontend do atendimento deve nascer para:

- funcionar agora de forma independente em modo mock
- integrar depois com Frappe
- e futuramente ser encaixado como modulo do Sistema de Polos

---

## 2. Principio arquitetural

Este frontend nao e um site solto.

Ele deve nascer como:

- modulo de atendimento
- com fronteiras claras
- preparado para integracao
- desacoplado da UI nativa do Frappe

---

## 3. Papel do frontend

O frontend deve:

- controlar a experiencia do usuario
- renderizar FAQ, filas, dashboards e fluxos
- consumir dados via servicos
- funcionar com mocks agora
- integrar com API do Frappe depois

O frontend nao deve:

- concentrar regras de negocio profundas
- acoplar componentes diretamente ao backend
- depender visualmente do Desk padrao do Frappe

---

## 4. Papel do Frappe

O Frappe sera a engine de backend para:

- registros de atendimento
- filas
- SLA
- criticidade
- permissoes
- historico
- FAQ persistida
- auditoria
- dashboards

---

## 5. Estrutura modular desejada

O frontend deve se organizar por areas:

- aluno
- op
- admin
- faq-builder
- services
- mocks
- docs

Exemplo conceitual:

```text
atendimento/
  aluno/
  op/
  admin/
  faq-builder/
  services/
  mocks/
```

---

## 6. Funcionamento em fases

### Fase atual

- modo mock
- sem backend real
- documentacao viva
- rotas navegaveis
- telas testaveis

### Fase seguinte

- integracao com API do Frappe
- dados reais
- autenticacao e permissoes reais
- persistencia de FAQ e atendimentos

### Fase futura

- integracao com Sistema de Polos
- integracao com outros sistemas institucionais
- inteligencia e automacao
- IA e ML

---

## 7. Integracao futura com Sistema de Polos

O frontend deve ser construido para suportar:

- shell externo
- menu externo
- autenticacao compartilhada
- reuso de layout superior
- carregamento como modulo ou subaplicacao

Ou seja, as paginas internas devem funcionar mesmo se, no futuro, o topo ou sidebar principal vier do Sistema de Polos.

---

## 8. Camada de servicos

Toda futura integracao com backend deve passar por uma camada de servicos.

Objetivos:

- desacoplar UI do backend
- permitir mocks e dados reais
- facilitar testes
- permitir futura troca de endpoint ou engine sem reescrever a UI

---

## 9. Preview e teste

A arquitetura deve permitir:

- navegar sem backend real
- validar jornada do aluno
- validar fila do OP
- validar dashboard admin
- usar JSONs mockados como fonte de dados

---

## 10. Resultado esperado

O frontend deve nascer:

- testavel
- modular
- desacoplado
- pronto para ser encaixado no Sistema de Polos
- preparado para Frappe agora e expansao futura depois
