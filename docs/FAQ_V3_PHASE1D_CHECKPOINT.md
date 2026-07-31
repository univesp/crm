# FAQ v3 — checkpoint da Fase 1d

## Resultado

A Biblioteca e o Editor antigos foram substituídos, nas rotas institucionais, por duas
superfícies v3. O fluxo reúne conteúdo de aluno e público, playbooks de OP, BPO e
Analista, encaminhamento, política documental, mídia por URL, vigência, histórico,
aprovação e prévia por persona.

O cockpit operacional passou a resolver o playbook pelo `node_id` registrado no
atendimento. Apenas ações que efetivamente usam a orientação geram
`case.knowledge_applied`; abrir o painel não altera a métrica.

## Entregas

- Biblioteca com estados em português, tipo Aluno/Público/Mista, tema, responsável,
  vigência, alteração, indicadores de conteúdo e playbook.
- Ações de abrir, duplicar, arquivar, restaurar e excluir quando o lifecycle permite.
- Editor responsivo em árvore, conteúdo e prévia por persona.
- Camadas Aluno, Público externo, OP, BPO e Analista no mesmo nó.
- Herança BPO ← OP por campo, com indicação visual.
- Playbook com objetivo, checklist, sistemas, documentos, resposta sugerida, ações,
  critérios de escalonamento e resultados.
- IDs estáveis nos itens estruturados.
- Bloqueios de validação explicados antes da aprovação.
- Lifecycle operável no editor, inclusive publicação de versão já aprovada quando não
  existe rascunho.
- Remoção da publicação avançada, `p50`, prioridades numéricas, controles sem efeito,
  redundâncias e estados em inglês das rotas novas.
- Registro auditável de aplicação de orientação em um atendimento.

## Decisões de UX

1. O foco primário é o tema e a jornada, não a versão técnica.
2. A prévia responde “como esta pessoa verá o fluxo”, sem criar um modo separado.
3. Vigência e aprovação permanecem juntas porque determinam quando o conteúdo pode
   entrar em operação.
4. O BPO começa herdando o OP e só exibe diferenças configuradas, reduzindo duplicação.

## Validação executada

- `vue-tsc --noEmit`: aprovado.
- ESLint focado nos arquivos alterados: aprovado, sem avisos.
- Build Vite de produção: aprovado, 453 módulos.
- Playwright integrado: 5 testes aprovados.
- Gateway Node: 17 testes aprovados.
- Backend: Ruff aprovado.
- Grafo e roteamento puros: 9 testes aprovados.
- Inspeção visual em desktop e largura de 768 px: aprovada.

## Riscos e pendências

- A validação visual foi feita no ambiente local com respostas institucionais
  interceptadas. A ativação real em homolog depende do deploy dos DocTypes e patches
  das fases anteriores.
- Mídia nesta fase aceita referências institucionais por URL. Upload seguro pertence
  à Fase 5.
- Permissões colaborativas por tema entram na Fase 2; nesta fase o editor permanece
  restrito ao Admin.

## Teste do usuário

**Necessário para validar linguagem e ergonomia, mas não bloqueia a Fase 1e.**

Roteiro:

1. Abrir `Admin > FAQs e orientações`.
2. Criar um fluxo do tipo Mista.
3. Editar uma resposta para aluno.
4. Preencher o playbook OP e confirmar a herança no BPO.
5. Alternar a prévia entre Aluno, OP e BPO.
6. Localizar vigência, bloqueios e envio para aprovação.
7. Voltar à Biblioteca e localizar arquivar, restaurar e excluir.

Resultado esperado: nenhuma ação exige acessar a tela antiga ou interpretar termos
técnicos de publicação.
