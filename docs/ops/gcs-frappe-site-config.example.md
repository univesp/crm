# GCS — exemplo site_config Frappe (nao commitar credenciais)

Apos criar bucket `univesp-crm-attachments-homolog` no projeto `univesp-201808`:

```json
{
  "file_storage": "s3",
  "s3_bucket": "univesp-crm-attachments-homolog",
  "s3_key": "GOOGLE_ACCESS_KEY",
  "s3_secret": "GOOGLE_SECRET",
  "s3_endpoint_url": "https://storage.googleapis.com",
  "s3_signature_version": "s3v4",
  "antimalware_endpoint": "https://ANTIMALWARE_RUN_URL/scan",
  "antimalware_token": "SECRET_MANAGER_REFERENCE",
  "public_document_retention_days": 180
}
```

## Chaves esperadas

| Chave | Descricao |
|-------|-----------|
| `file_storage` | Deve ser `"s3"` (compat GCS) |
| `s3_bucket` | Nome do bucket |
| `s3_key` | HMAC access key da SA |
| `s3_secret` | HMAC secret da SA |
| `s3_endpoint_url` | `https://storage.googleapis.com` |
| `antimalware_endpoint` | Endpoint privado do scanner no Cloud Run |
| `antimalware_token` | Segredo compartilhado injetado pelo Secret Manager |
| `public_document_retention_days` | Retenção dos documentos públicos; padrão 180 dias |

Credenciais HMAC do GCS via Service Account (Interoperability). Montar SA JSON em `/run/secrets/gcs-sa.json` na VM — ver `env.vm.example` (`GCS_PROJECT`, `GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS`).

## Validacao (sem bucket)

Na VM com bench:

```bash
chmod +x ops/vm/scripts/validate-gcs-site-config.sh
./ops/vm/scripts/validate-gcs-site-config.sh crm.localhost
```

Reporta chaves ausentes no `site_config` — util mesmo antes do bucket existir.

## Validacao funcional

Upload de anexo no protocolo aluno; arquivo deve aparecer no bucket, nao no disco local.

Para a FAQ pública, a API falha fechada quando o bucket ou o antimalware não estão
configurados. O scanner deve responder JSON `{"status":"clean"}` apenas após analisar
o conteúdo; qualquer outra resposta mantém o arquivo fora do protocolo.
