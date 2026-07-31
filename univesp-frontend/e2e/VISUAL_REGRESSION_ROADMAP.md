# Roadmap — regressão visual E2E

Comandos:

```bash
npm run test:e2e:visual          # rodada 1 — FAQ v3 núcleo
npm run test:e2e:visual:round2   # rodada 2 — FAQ diálogos + CRM scaffold
npm run test:e2e:visual:all      # tudo
```

Atualizar baselines: acrescente `--update-snapshots` ao comando.

## Rodada 1 (concluída)

| Superfície | Spec | Snapshots |
|------------|------|-----------|
| Modal Criar fluxo | `faq-v3-visual-regression.spec.js` | 3 viewports |
| Modal Criar tema | idem | 1 |
| Biblioteca lista + grants | idem | 2 |
| Editor rascunho / avançado | idem | 2 |
| Mapa, configurações, envio | idem | 3 |
| Estados editorial | idem | 4 |

## Rodada 2 — FAQ v3 (spec pronta)

| Superfície | Arquivo | Snapshot esperado |
|------------|---------|-------------------|
| Histórico de versões | `faq-v3-visual-regression-round2.spec.js` | `historico-versoes.png` |
| Playbook da etapa | idem | `playbook-etapa.png` |
| Simular jornada | idem | `simular-jornada.png` |
| Importar (vazio) | idem | `importar-vazio.png` |
| Importar (com diff) | idem | `importar-com-diff.png` |
| Confirmar publicação | idem | `confirmar-publicacao.png` |
| Pendências | idem | `pendencias-validacao.png` |
| Mobile 375 + editor | idem | `editor-mobile-375.png` |
| Modal Criar fluxo mobile / zoom | idem | `criar-fluxo-modal-mobile-375.png`, `criar-fluxo-modal-zoom-200-sim.png` |

Helpers compartilhados: `e2e/helpers/faq-v3-visual-helpers.js`

## Rodada 2 — resto do CRM (scaffold)

| Módulo | Spec | Status |
|--------|------|--------|
| Dashboard admin | `crm-visual-regression-round2.spec.js` | **implementado** |
| Admin usuários | idem | `test.fixme` — copiar mocks de `admin-users.spec.js` |
| Admin configurações | idem | `test.fixme` — copiar mocks de `admin-settings.spec.js` |
| Cockpit operacional | idem | `test.fixme` — copiar mocks de `operational-live.spec.js` |
| FAQ aluno | idem | `test.fixme` — copiar mocks de `student-published-faq.spec.js` |
| FAQ OP/BPO | idem | `test.fixme` — copiar mocks de `published-faq-personas.spec.js` |
| Sugestões área | idem | `test.fixme` — copiar mocks de `knowledge-collaboration.spec.js` |

## Rodada 3 (backlog)

- [ ] Teclado-only: abrir/fechar cada diálogo FAQ v3
- [ ] Zoom 200% nativo (se Playwright expuser API) ou validação manual documentada
- [ ] Bloco de mídia institucional no editor
- [ ] Personas: gestor_area, analista_area, op_externo
- [ ] CI: job separado `test:e2e:visual:all` no pipeline

## Armadilhas conhecidas

- **`crm-form-grid` dentro de modais/painéis fixos** herda `@container crm-page` e colapsa layout → usar coluna única no escopo do modal (corrigido em Criar fluxo, Criar tema, grants).
- Snapshots são **OS/browser-specific** (`-chromium-win32.png`); gerar baselines no mesmo ambiente do CI.
