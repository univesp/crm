# Knowledge Studio — operação rápida

Ferramenta de curadoria **independente do CRM**, rodando na mesma VM de homolog.

## Acesso (sem depender do TI)

1. Na VM, suba o stack:

```bash
docker compose -f docker-compose.vm.yml up -d knowledge-studio
```

2. Time acessa:

```
http://<IP-OU-DOMINIO-VM>:8090
```

Exemplo: `http://homolog-crm.univesp.br:8090` (se a porta estiver liberada no firewall da VM).

3. PIN opcional (recomendado):

```bash
# .env.vm
KNOWLEDGE_STUDIO_PIN=seu-pin-interno
KNOWLEDGE_STUDIO_PORT=8090
```

Informe o PIN ao time. Eles colocam no campo PIN da tela.

## Fluxo em 10 passos

| # | Step | Quem | Onde |
|---|------|------|------|
| 1 | Crawler | Automático | Botão no Studio |
| 2 | Validar estrutura mínima | Time | Studio |
| 3 | Exportar jobs IA | Automático | Studio |
| 4 | Rodar prompts (Cursor/ChatGPT/Gemini) | Cada pessoa | Local |
| 5 | Importar JSON de análise | Time | Studio |
| 6 | Curadoria item a item | Time | Studio |
| 7 | Export XLSX | Automático | Studio → `export/` |
| 8 | Import FAQ Builder | Time | CRM `/admin/faq-editor` |
| 9 | Testes internos + piloto OP/aluno | Time | Homolog CRM |
| 10 | Produção | Admin | CRM |

## IA externa (sem API na VM)

Depois do passo 3, baixe a pasta da execução:

```
/data/runs/<run-id>/ai_jobs/<pacote>/
  input.json
  prompt_simplify_and_tree.md
  prompt_media_audit.md
  README.md
```

Cada analista:
1. Abre o prompt.
2. Anexa `input.json` (ou cola o conteúdo).
3. Salva resposta como `analysis_simplify_and_tree_NOME.json` (e/ou `analysis_media_audit_NOME.json`).
4. Importa os JSONs no Studio (passo 5).

**Múltiplas visões:** cada pessoa gera um arquivo com sufixo diferente; todos são importados.

### Validar mídia depois

Quando houver prints/vídeos:
1. Faça upload em `media/` (via SFTP na VM ou endpoint `/api/runs/:id/media`).
2. Use `prompt_media_placement.md` com `media_input.json`.
3. Importe `analysis_media_placement_NOME.json`.

## Comandos CLI (opcional na VM)

```bash
python3 ops/knowledge-ingest/pipeline.py crawl
python3 ops/knowledge-ingest/pipeline.py export-ai-jobs tools/knowledge-studio/data/runs/<run-id>
python3 ops/knowledge-ingest/pipeline.py import-ai-analysis tools/knowledge-studio/data/runs/<run-id>
python3 ops/knowledge-ingest/pipeline.py export-xlsx tools/knowledge-studio/data/runs/<run-id>
```

## Subir FAQ para produção

1. Baixe `export/faq-<pacote>.xlsx` (SFTP ou peça zip).
2. No CRM: `/admin/faq-editor` → Importação → dry-run → aplicar.
3. Teste jornada no simulador.
4. Piloto com OPs/alunos em homolog.
5. Publicar.

## Futuro

- IA local na VM (Fase produção): substitui passo 4 externo por job batch interno.
- Integração `/admin/curadoria` no CRM: mesma API, mesmos arquivos.
