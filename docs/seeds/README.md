# Seeds FAQ — carga inicial MVP

Bundles JSON canônicos para importação no **Admin > FAQ Builder > Importação**.

| Arquivo | `tipo_faq` | Uso |
|---------|------------|-----|
| `faq-aluno-seed.json` | `aluno` | Portal do aluno |
| `faq-op-seed.json` | `op` | Playbook OP |
| `faq-publico-seed.json` | `publico` | Rota `/publico` |

## Fluxo

1. Abra o fluxo correspondente no FAQ Builder (crie bundle com o mesmo `tipo_faq`).
2. Modo **Importação** → JSON → dry-run.
3. Revise, publique após aprovação.
4. Valide no portal (`/aluno`, `/op/playbook`, `/publico`).

Ver também `docs/FAQ_CARGA_RAPIDA.md`.
