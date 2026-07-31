# Seeds FAQ — carga inicial MVP

> **Atualização 2026-07:** o modelo canônico é **um fluxo por tema** com canais (Portal do Aluno / Atendimento público). Seeds v2 por `tipo_faq` permanecem para migração; preferir seeds v3 unificados quando disponíveis.

Bundles JSON para importação no **Admin > FAQ Builder > Importação**.

| Arquivo | Legado `tipo_faq` | Uso |
|---------|------------|-----|
| `faq-aluno-seed.json` | `aluno` | Conteúdo do canal Portal do Aluno |
| `faq-op-seed.json` | `op` | Playbooks OP (mesmos nós do fluxo) |
| `faq-publico-seed.json` | `publico` | Conteúdo do canal Atendimento público |

## Fluxo

1. Abra (ou crie) o fluxo único do tema no Editor v3.
2. Marque **Disponível em** conforme os canais desejados.
3. Modo **Importar ou atualizar** → JSON/XLSX → revise o diff.
4. Admin pode publicar diretamente; Analista envia à revisão.
5. Valide no portal (`/aluno`, playbook OP, `/publico`).

## Caminhos absolutos (referencia)

```
docs/seeds/faq-aluno-seed.json
docs/seeds/faq-op-seed.json
docs/seeds/faq-publico-seed.json
```

Ver também `docs/FAQ_CARGA_RAPIDA.md`.
