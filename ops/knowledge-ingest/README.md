# Knowledge Ingest — Manual do Aluno → FAQ

Pipeline batch que alimenta o **Knowledge Studio** (`tools/knowledge-studio/`).

## Comandos

```bash
python3 ops/knowledge-ingest/pipeline.py crawl
python3 ops/knowledge-ingest/pipeline.py export-ai-jobs tools/knowledge-studio/data/runs/<run-id>
python3 ops/knowledge-ingest/pipeline.py import-ai-analysis tools/knowledge-studio/data/runs/<run-id>
python3 ops/knowledge-ingest/pipeline.py export-xlsx tools/knowledge-studio/data/runs/<run-id>
```

## Saídas por execução

```
tools/knowledge-studio/data/runs/<run-id>/
  manifest.json
  chunks.json
  packages.json
  ai_jobs/<pacote>/
    input.json
    prompt_*.md
  export/faq-<pacote>.xlsx
```

## IA externa

Prompts em `prompts/`. Cada analista gera `analysis_*.json` e importa no Studio.

## Dependências

```bash
pip install -r ops/knowledge-ingest/requirements.txt
```

No Docker do Studio, dependências já são instaladas.

## Avaliar base histórica de chamados

Use assuntos (150k tickets) para medir cobertura da FAQ gerada:

```bash
python3 ops/knowledge-ingest/src/evaluate_tickets.py \
  --csv /caminho/chamados.csv \
  --column assunto \
  --run-dir tools/knowledge-studio/data/runs/<run-id> \
  --output tools/knowledge-studio/data/runs/<run-id>/ticket_coverage.json
```

Respostas da terceirizada **não devem** virar FAQ automaticamente; use só assuntos para priorizar temas e medir lacunas.
