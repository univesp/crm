# Ownership operacional: fechamento backend + legado

## 1) Enforcement canônico no servidor

Endpoints críticos que **devem validar ownership**:

- `draft_create`
- `protocol_create`
- `protocol_update`
- `protocol_follow_up`
- `bundle_import`
- `bundle_publish`

Checks obrigatórios por endpoint foram consolidados em:

- `src/contracts/operationalOwnershipBackendContract.js`
- `OPERATIONAL_OWNERSHIP_BACKEND_REQUIRED_CHECKS`

Invariantes canônicos:

1. Não publica bundle sem coverage completa de ownership.
2. Não cria draft/protocolo sem owner efetivo.
3. Não aceita referência inválida de queue/area/role.
4. Não aceita protocolo sem source binding quando a origem é FAQ.
5. Não aceita protocolo sem `bundle_version` quando exigido.
6. Snapshot de owner de caso aberto é imutável.
7. Sessão iniciada mantém vínculo com `bundle_version` de origem.

## 2) Contrato canônico de erro

Erros canônicos consolidados:

- `OWNER_MISSING`
- `INVALID_OWNER_TYPE`
- `OWNER_REFERENCE_INVALID`
- `OWNER_QUEUE_NOT_FOUND`
- `OWNER_AREA_NOT_FOUND`
- `OWNER_ROLE_NOT_FOUND`
- `SOURCE_BINDING_INVALID`
- `BUNDLE_VERSION_REQUIRED`
- `MISSING_SOURCE_NODE`
- `PUBLISH_BLOCKED_BY_OWNERSHIP_COVERAGE`
- `LEGACY_OWNERSHIP_REQUIRES_MIGRATION`
- `LEGACY_SOURCE_BINDING_REQUIRES_MIGRATION`
- `LEGACY_FALLBACK_REQUIRES_MIGRATION`

Cada código define:

- `httpStatus`
- `technicalMessage`
- `userMessage`
- `entity`
- `field`
- `uiAction`

Implementado em:

- `src/contracts/operationalOwnershipBackendContract.js`

## 3) Estratégia de legado/fallback

A consolidação do legado foi formalizada com política explícita:

- `transition` (default):
  - permite leitura de legado
  - permite follow-up de legado
  - bloqueia criação/escrita nova baseada em payload legado
  - bloqueia fallback de owner em escrita
  - bloqueia source binding legado em escrita nova
- `strict`:
  - bloqueia leitura/escrita de legado (fail-fast)

Implementado em:

- `src/services/operationalOwnershipServerRuntime.js`
- `DEFAULT_OPERATIONAL_OWNERSHIP_LEGACY_POLICY`
- `normalizeOperationalOwnershipLegacyPolicy`
- `classifyOperationalOwnershipLegacyState`

## 4) Saneamento progressivo do legado

Auditoria canônica disponível:

- `auditLegacyOwnershipRecords(protocols, options)`

Classificações:

- `canonical`
- `legacy_safe_to_normalize`
- `legacy_requires_manual_migration`

Recomendação operacional:

1. Rodar auditoria em lote.
2. Migrar automaticamente os casos `legacy_safe_to_normalize`.
3. Encaminhar `legacy_requires_manual_migration` para intervenção guiada.
4. Virar flag para `strict` após backlog legado cair para zero.

## 5) Persistência canônica por bundle/version

Pré-condições para servidor/Frappe:

- protocolo novo sempre com:
  - `sourceBundleId`
  - `sourceBundleVersionId`
  - `sourceNodeId`
  - snapshot de owner resolvido
- publicação do bundle sempre com:
  - validação de ownership coverage
  - `active_bundle_version_id`
  - supersedência explícita (`supersedes_version_id`)

## 6) Estado atual da implementação frontend/mock

Já aplicados:

- validação referencial (queue/area/role) em criação de draft/protocolo/follow-up/op-assisted
- validação de coverage no publish/import do builder
- contrato canônico de erro preparado para mapear resposta de backend
- política de legado explícita, sem fallback silencioso em escrita nova

Dependência restante para “fechado sem ressalva em produção”:

- enforcement transacional definitivo no backend/Frappe usando os mesmos códigos canônicos.
