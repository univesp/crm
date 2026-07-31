# Passagem para TI - Atendimento UNIVESP (topologia VM)

> Checklist canônico e atualizado: `docs/TI_HOMOLOGACAO.md`. Este arquivo mantém apenas os passos específicos da VM.

Este roteiro separa o que ja esta no codigo do que exige acesso administrativo.
Execute primeiro em homologacao. Nao registre valores de segredo em chamados,
prints, terminal compartilhado ou Git.

## Entrega pronta no repositorio

- Gateway SSO/BFF versionado e protegido por sessao Redis, rate limit, CSRF,
  validacao OIDC/SAML e assinatura HMAC para o Frappe.
- App Frappe `univesp_atendimento` com perfis, escopos, estados e API de tickets.
- Dependencias Helpdesk e Telephony fixadas em commits compativeis com Frappe 15.
- Nginx com Vue na frente e APIs genericas do Frappe bloqueadas externamente.
- Scripts de instalacao, deploy, preflight e smoke tests.

## 1. Preparacao exclusiva da TI

1. Revogar a API key antiga do Frappe encontrada no historico e encerrar sessoes
   que possam ter sido expostas.
2. Criar no Frappe um usuario tecnico exclusivo, por exemplo
   `svc.crm.gateway@univesp.br`, habilitado como System User. Nao usar
   `Administrator` e nao reutilizar uma conta pessoal.
3. Gerar uma API key/secret para essa conta e armazenar os valores no secret
   manager institucional.
4. Gerar tres segredos independentes de pelo menos 32 bytes para
   `SESSION_SECRET`, `JWT_SECRET` e `UNIVESP_BFF_SHARED_SECRET`.
5. Manter no Entra ID o callback
   `https://homolog-crm.univesp.br/api/sso/azure/callback`. Para SAML, manter
   `https://homolog-crm.univesp.br/api/sso/saml/callback`.

## 2. Configuracao da VM

Completar `/var/crm/sso-gateway/.env` usando `sso-gateway/.env.example`. Valores
obrigatorios para homologacao:

```dotenv
NODE_ENV=production
APP_BASE_URL=https://homolog-crm.univesp.br
GATEWAY_REDIS_URL=redis://10.122.225.195:6379
FRAPPE_ORIGIN=http://127.0.0.1:8000
FRAPPE_SITE_NAME=crm.localhost
FRAPPE_API_KEY=<secret-manager>
FRAPPE_API_SECRET=<secret-manager>
UNIVESP_BFF_SHARED_SECRET=<secret-manager>
```

Configurar exatamente o mesmo `UNIVESP_BFF_SHARED_SECRET` no site, sem exibir o
valor depois:

```bash
cd /var/crm/frappe-bench
bench --site crm.localhost set-config univesp_bff_shared_secret '<secret-manager>'
```

Executar o diagnostico inicial:

```bash
sudo CRM_ROOT=/var/crm REPO_DIR=/var/crm/repository \
  bash /var/crm/repository/ops/vm/scripts/preflight-atendimento.sh
```

Antes da instalacao, Helpdesk/Telephony ausentes aparecem apenas como avisos.
Qualquer item marcado como `ERRO` deve ser corrigido.

## 3. Instalacao na ordem correta

```bash
cd /var/crm/repository
git fetch origin
git checkout univesp/cloudrun-homolog
git pull --ff-only origin univesp/cloudrun-homolog

BENCH_OWNER="$(stat -c '%U' /var/crm/frappe-bench)"
sudo -u "$BENCH_OWNER" CRM_ROOT=/var/crm \
  bash /var/crm/repository/ops/vm/scripts/install-atendimento-backend.sh

sudo CRM_ROOT=/var/crm \
  bash /var/crm/repository/ops/vm/scripts/deploy-sso-gateway.sh
```

Ainda nao aplicar o Nginx. Primeiro cadastrar os perfis e executar o preflight
pos-instalacao.

## 4. Perfis minimos para o teste

No Frappe, criar registros em `Univesp Access Profile` usando os e-mails reais
dos dois testadores.

Aluno:

```json
{
  "profile_key": "aluno",
  "scopes_json": {},
  "actions_json": ["create_ticket", "view_ticket", "reply_ticket", "attach_ticket"]
}
```

OP:

```json
{
  "profile_key": "op",
  "scopes_json": {"queues": ["Atendimento Geral"]},
  "actions_json": ["view_ticket", "reply_ticket", "attach_ticket", "assign_ticket", "transition_ticket"]
}
```

Criar e habilitar tambem a equipe `HD Team` chamada `Atendimento Geral`. O nome
da equipe e o valor em `queues` devem ser identicos.

## 5. Validacao e abertura do frontend

```bash
sudo MODE=post-install CRM_ROOT=/var/crm REPO_DIR=/var/crm/repository \
  bash /var/crm/repository/ops/vm/scripts/preflight-atendimento.sh

sudo REPO_ROOT=/var/crm/repository VUE_APP_DIR=/var/crm/univesp-frontend \
  bash /var/crm/repository/ops/vm/scripts/apply-frontdoor.sh
```

Aceite obrigatorio:

- usuario sem sessao recebe 401 em `/api/me` e `/api/app/v1/tickets`;
- `/api/method/*`, `/api/resource/*`, `/app` e `/desk` nao ficam publicos;
- aluno entra pelo SSO, cria protocolo e ve somente os proprios protocolos;
- OP ve somente `Atendimento Geral`, responde e muda o estado;
- aluno visualiza a resposta apos sair e entrar novamente;
- reiniciar Gateway e VM nao perde sessao persistida nem tickets;
- nenhum usuario sem `Univesp Access Profile` recebe perfil automatico.

## 6. Rollback

Se o Gateway falhar, restaurar a revisao anterior do repositorio e executar
novamente `deploy-sso-gateway.sh`. O `.env` e sempre preservado pelo script.

Se migrations ou instalacao falharem, nao continuar com o Nginx. Restaurar o
backup criado automaticamente por `install-atendimento-backend.sh` seguindo o
procedimento padrao do Bench e revisar os logs antes de nova tentativa.

Se apenas o Nginx falhar, manter a configuracao anterior em
`/etc/nginx/sites-available`, executar `nginx -t` e recarregar somente depois de
o teste sintatico passar.
