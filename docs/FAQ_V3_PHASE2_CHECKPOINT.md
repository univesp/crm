# FAQ v3 — checkpoint da Fase 2

## Resultado

A colaboração editorial passou a usar o conteúdo versionado e o modelo institucional
de permissões. OP e BPO não recebem acesso por padrão: o Admin concede o direito de
sugerir por pessoa ou grupo, tema e período. A sugestão nunca altera uma versão
publicada.

## Entregas

- DocType `Univesp Knowledge Suggestion` com contexto de versão, nó, camada e alvo
  estável.
- Estados `received`, `in_review`, `incorporated` e `rejected`.
- Hash do valor atual para impedir incorporação sobre conteúdo que mudou.
- Sugestões por nó, bloco, item de checklist e campo de playbook.
- Suporte à herança BPO ← OP na leitura do valor sugerido.
- Conversão da sugestão em rascunho novo ou existente.
- Fila real de revisão para Analista e Gestor.
- Incorporação, recusa e justificativas auditáveis.
- Notificações em tempo real ao revisor e ao autor.
- Alerta de SLA ao grupo Admin de contingência, sem aprovação implícita.
- Perfis separados `faq-contributor-op` e `faq-contributor-bpo`.
- Concessões reutilizam `Permission Assignment`, com escopo
  `knowledge_themes`, vigência e validação de `base_persona`.
- Painel Admin para conceder e revogar permissão de sugestão.
- Botão contextual **Sugerir melhoria** no atendimento, visível apenas quando a
  autorização efetiva e o lineage da FAQ estão presentes.
- Analista edita/incorpora, Gestor aprova e Admin publica.
- Gestor não recebe ação de publicação; Admin não substitui a aprovação normal.

## Validação executada

- Ruff nos arquivos da Fase 2: aprovado.
- Typecheck Vue: aprovado.
- ESLint focado: aprovado.
- Build Vite de produção: aprovado, 453 módulos.
- Gateway: 17 testes aprovados.
- Playwright: 7 cenários aprovados, incluindo:
  - concessão a OP por tema e validade;
  - Analista incorporando sem alterar publicado;
  - Gestor aprovando sem poder publicar;
  - Admin publicando versão previamente aprovada.

## Riscos e pendências

- A execução integrada dos DocTypes e do scheduler depende de aplicar os patches em
  um site Frappe. Este ambiente local não possui `bench`.
- O script `npm run build` da raiz ainda aponta para o diretório legado `frontend`
  sem dependências instaladas. O build canônico validado nesta fase é o de
  `univesp-frontend`.
- A flag `knowledge_collaboration` permanece desligada por padrão até a instalação
  dos DocTypes no ambiente.

## Teste do usuário

**Necessário para validar as regras operacionais, mas não bloqueia a Fase 3.**

1. Como Admin, conceder a um OP o direito de sugerir no tema `acesso-ava`.
2. Como OP, abrir um caso originado nessa FAQ e enviar uma sugestão.
3. Como Analista, iniciar a revisão e incorporar a sugestão em rascunho.
4. Como Gestor, aprovar o rascunho.
5. Confirmar que o Gestor não consegue publicar.
6. Como Admin, publicar a versão aprovada.
7. Revogar a concessão e confirmar que o botão deixa de aparecer para o OP.

