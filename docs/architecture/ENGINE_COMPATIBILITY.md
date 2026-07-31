# Compatibilidade da engine de homologacao
Levantamento somente leitura realizado na VM `crm-vm` em 2026-07-13.

## Base instalada

- Frappe `15.113.3`, branch `version-15`;
- CRM `1.76.0`, branch `main`;
- MariaDB `10.11.18`;
- Python `3.11.2` e Node.js `20.20.2`;
- Redis gerenciado em rede;
- apps instalados no site: `frappe` e `crm`.

## Decisao

Nao migrar para Frappe 16 durante a integracao do atendimento. O Helpdesk
fixado exige Frappe `>=15.109.0,<17.0.0`, portanto a engine atual e compativel.
A instalacao acrescenta, nessa ordem:

1. Telephony no commit `58d32184e44b193e27498d3dd156085c793b7528`;
2. Helpdesk `1.27.0` no commit `6b423f8fba6d4c7f8ff5db56f197243f6549d450`;
3. app `univesp_atendimento` desta mesma revisao do repositorio.

Os commits sao fixados para que homologacao e uma restauracao futura usem a
mesma combinacao. Atualizacoes devem ocorrer em PR proprio, com backup e teste
de migration, e nunca acompanhando automaticamente o `main` dos projetos.

## Pendencias externas

- criar um usuario tecnico Frappe exclusivo para o Gateway e gerar API key;
- usar o mesmo segredo HMAC no site e no Gateway;
- cadastrar perfis de OP/gestores/admin antes do teste;
- **fonte oficial alunos:** import Trino `postgresql-sei` (ver `docs/crm-import-student-directory.md`);
- corrigir a incompatibilidade de teste existente no CRM entre
  `CRM Lead.assign_agent` e `frappe.desk.form.assign_to.add`.
