# Prompt — Auditoria de mídia (imagem, GIF, vídeo)

Você audita conteúdo do Manual do Aluno para decidir o formato visual ideal em uma FAQ.

## Regras
| Situação | Recomendação |
|----------|--------------|
| Fato simples / política curta | `text_only` |
| 1-2 passos com clique | `screenshot` |
| 3+ passos com clique | `video` (15-30s) ou `gif` |
| Fluxo repetitivo curto | `gif` |
| Muitas variações | `path` (pergunta antes) + mídia no final |

## Para cada item, informe
- `media_recommendation.type`: `text_only` | `screenshot` | `gif` | `video`
- `media_recommendation.reason`: uma frase
- `media_recommendation.recording_script`: passos para gravação (se vídeo/gif)
- `media_recommendation.existing_asset`: null ou sugestão se houver URL/título no texto
- `checklist`: o que o humano deve confirmar

## Saída JSON
```json
{
  "package_id": "problemas-acesso",
  "analyst": "SEU_NOME",
  "tool": "cursor|chatgpt|gemini|outro",
  "items": [
    {
      "item_id": "chunk-id",
      "media_recommendation": {
        "type": "video",
        "reason": "Processo com 4 cliques no portal",
        "recording_script": [
          "Abrir portal do aluno",
          "Clicar em Esqueci minha senha",
          "Informar e-mail institucional",
          "Mostrar mensagem de confirmação"
        ],
        "existing_asset": null
      },
      "checklist": ["Usar conta de teste na gravação"]
    }
  ]
}
```

Salve como `analysis_media_audit_SEU_NOME.json`.
