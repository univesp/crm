# Handoff da TI para homologação do Atendimento UNIVESP

Este é o checklist canônico para manter o candidato acadêmico atualizado e
preparar a homologação. Os detalhes específicos de VM permanecem em
`ops/vm/HANDOFF_TI.md`; a topologia Cloud Run está em `ops/cloudrun/README.md`.

## Estado e regra de branch

- `origin/main`: espelho do upstream; não recebe customizações UNIVESP.
- `origin/univesp/cloudrun-homolog`: linha acadêmica estável da homologação.
- Mudanças: feature branch curta, PR com base `univesp/cloudrun-homolog`,
  checks aprovados e revisão humana.
- Deploy: somente manual, a partir do SHA já integrado à branch acadêmica.
- Nunca usar `latest`; imagem e rollback usam tag/digest do commit.

## 1. Configuração única no GitHub

Crie o Environment `homolog` e configure:

1. required reviewers da TI;
2. branch permitida: `univesp/cloudrun-homolog`;
3. prevenção de self-review, se disponível;
4. tempo de espera compatível com a janela de mudança.

Variáveis obrigatórias do repositório:

- `GCP_PROJECT_ID`, `GCP_REGION`, `ARTIFACT_REPOSITORY`, `IMAGE_NAME`;
- `FRAPPE_SITE_NAME`, `PUBLIC_DOMAIN`, `SSO_GATEWAY_ORIGIN`;
- `DB_TYPE`, `DB_SETUP_MODE`, `DB_NAME`, `DB_USER`,
  `DB_ROOT_USERNAME`, `CLOUDSQL_INSTANCE`;
- `SITES_BUCKET`, `VPC_NETWORK`, `VPC_CONNECTOR`,
  `VPC_CONNECTOR_RANGE`, `CLOUDRUN_RUNTIME_SERVICE_ACCOUNT`;
- nomes dos secrets de DB, administrador e Redis;
- `CLOUDFLARE_ZONE_ID`, quando o DNS for administrado pelo workflow.

`SSO_GATEWAY_ORIGIN` deve ser uma origem HTTPS alcançável pelo front door.
O deploy falha fechado se ela estiver ausente.

Secrets obrigatórios:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOYER_SERVICE_ACCOUNT`;
- `DB_PASSWORD`, `ADMIN_PASSWORD`;
- `REDIS_CACHE_URL`, `REDIS_QUEUE_URL`, `REDIS_SOCKETIO_URL`;
- `CLOUDFLARE_API_TOKEN`, quando aplicável.

Não registrar valores em Git, logs, screenshots ou tickets.

## 2. Gateway SSO/BFF

O gateway deve estar publicado antes do front door. Confirmar:

- HTTPS e certificado válidos;
- Redis de sessão persistente;
- conta técnica Frappe exclusiva, nunca `Administrator`;
- `SESSION_SECRET`, `JWT_SECRET` e `UNIVESP_BFF_SHARED_SECRET`
  independentes, com pelo menos 32 bytes;
- o mesmo `UNIVESP_BFF_SHARED_SECRET` no gateway e no
  `site_config.json` do Frappe;
- callbacks Azure e SAML do domínio de homologação;
- `FRAPPE_ORIGIN` interno/privado, API key/secret e site name corretos;
- rotação e revogação documentadas.

Variáveis completas: `sso-gateway/.env.example`. Procedimento VM:
`ops/vm/HANDOFF_TI.md`.

## 3. Infraestrutura e dados

Antes de marcar `provision_infra=true`, confirmar se os recursos já existem.
Provisionamento repetido sem inventário pode alterar IAM ou rede.

Checklist:

- Artifact Registry e Workload Identity Federation;
- Cloud SQL e usuário/banco de homologação;
- backup recente, restore testado e RTO/RPO registrados;
- bucket de sites com retenção e acesso mínimo;
- VPC connector;
- Redis privado para cache, filas, socket.io e sessão do gateway;
- service account de runtime com IAM mínimo;
- quotas de Cloud Run, Cloud SQL, VPC e Artifact Registry;
- owners e alertas para web, worker, scheduler e bootstrap.

## 4. Gate do PR

O draft PR deve ter base `univesp/cloudrun-homolog` e passar:

- Atendimento CI: lint, typecheck, build, 64 foundation, 11 E2E,
  gateway e front-door tests;
- Semantic Commits;
- Semgrep;
- Pre-commit;
- revisão de autorização, migrations/DocTypes, edge e rollback.

Antes do merge, registrar no PR:

- SHA a implantar;
- janela, responsável e canal de incidente;
- imagem/digest anterior;
- backup de banco/site;
- critérios de sucesso e abort.

## 5. Deploy manual

No GitHub Actions, escolha `Univesp Cloud Run Homolog`:

1. selecione a branch `univesp/cloudrun-homolog`;
2. marque `confirm_homolog_deploy=true`;
3. use `provision_infra=false` no deploy normal;
4. obtenha aprovação do Environment `homolog`;
5. acompanhe build, push, bootstrap/migrate e serviços;
6. registre SHA, digest, revisões e horário.

O workflow não dispara por push.

## 6. Smoke obrigatório

Sem sessão:

- `/` e `/healthz` retornam 200;
- `/api/me` e `/api/app/v1/*` retornam 401;
- `/api/method/*`, `/api/resource/*`, `/app`, `/desk`,
  `/files` e `/socket.io` retornam 404.

Com contas sintéticas:

- aluno cria, lista e responde apenas ao próprio ticket;
- OP vê apenas suas filas, faz claim atômico, responde e transiciona;
- analista/gestor vê apenas sua área, atribui e salva governança;
- admin salva parâmetros e FAQ, publica e confirma consumo no portal;
- usuário A nunca lê ou altera objeto de B;
- worker e scheduler processam eventos após reinício.

## 7. Rollback

Rollback de código:

```bash
export GCP_PROJECT_ID=<projeto>
export GCP_REGION=<regiao>
export ROLLBACK_IMAGE_URI=<imagem-anterior-por-sha-ou-digest>
export CONFIRM_ROLLBACK=homolog
./ops/cloudrun/rollback.sh
```

O script troca somente a imagem de web, worker e scheduler e preserva a
configuração dos serviços. Ele não desfaz migration.

Rollback de dados:

1. interromper novas mudanças;
2. avaliar forward-fix primeiro;
3. para migration incompatível, restaurar banco e conteúdo do bucket seguindo
   o runbook institucional;
4. validar invariantes e smoke antes de reabrir o ambiente.

Nunca executar restore sem owner, backup identificado e confirmação explícita.

## 8. Rotina para permanecer atualizado

1. sincronizar upstream em janela própria;
2. rebase/merge da branch acadêmica com revisão;
3. atualizar dependências em PR separado;
4. executar gates e smoke em cada promoção;
5. revisar secrets, certificados, IdPs e acessos trimestralmente;
6. testar restore e rollback periodicamente;
7. manter este documento e `ops/cloudrun/README.md` alinhados ao workflow.

## 9. Carga de conteúdo

O processo rápido e auditável para FAQs está em
`docs/FAQ_CARGA_RAPIDA.md`. Conteúdo entra como rascunho, passa por dry-run,
revisão e só depois é publicado.