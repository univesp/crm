# GCS — exemplo site_config Frappe (nao commitar credenciais)

Apos criar bucket `univesp-crm-attachments-homolog` no projeto `univesp-201808`:

```json
{
  "file_storage": "s3",
  "s3_bucket": "univesp-crm-attachments-homolog",
  "s3_key": "GOOGLE_ACCESS_KEY",
  "s3_secret": "GOOGLE_SECRET",
  "s3_endpoint_url": "https://storage.googleapis.com",
  "s3_signature_version": "s3v4"
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
