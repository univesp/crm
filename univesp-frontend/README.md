# UNIVESP Frontend Prototype

Prototipo visual para desenhar a jornada de atendimento:

- triagem inicial com perguntas e opcoes prontas
- geracao de ticket para Frappe
- conversa assistida por IA
- handoff para atendimento humano
- espaco reservado para SSO SAML e integracoes

## Stack

- Vue 3
- Vue Router
- Pinia
- Tailwind CSS
- Vite

## Como rodar

```bash
cd univesp-frontend
npm install
npm run dev
```

Se preferir `yarn`, os scripts tambem seguem o padrao `yarn install` e `yarn dev`.

## Telas

- `/` mapa geral da jornada
- `/triagem` fluxo inicial com perguntas e respostas
- `/ticket` preview do contrato do ticket no Frappe
- `/chat-ia` simulacao do chatbot com contexto do ticket
- `/handoff` transferencia para atendente humano
- `/integracoes` arquitetura, SAML e mapa das pastas

## Estrutura

- `src/pages`: telas por etapa da jornada
- `src/components`: blocos reutilizaveis
- `src/data`: blueprint dos fluxos e catalogos mockados
- `src/services`: contratos placeholder para Frappe, IA e SAML
- `src/stores`: estado compartilhado do prototipo

## Proximos passos

1. Trocar mocks por endpoints reais do Frappe.
2. Definir o contrato de autenticacao SAML com o IdP.
3. Decidir se o ticket sera `Issue`, `HD Ticket` ou um DocType customizado.
4. Integrar a sessao do chatbot ao protocolo criado no backend.
