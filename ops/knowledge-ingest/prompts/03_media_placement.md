# Prompt — Validação e posicionamento de mídia

Use depois que o time tiver **prints, GIFs ou vídeos** prontos.

## Entrada
Arquivo `media_input.json` com:
- `package_id`
- `items[]` contendo `item_id`, título, rascunho de resposta
- `assets[]` com `asset_id`, `type` (image|gif|video), `filename`, `notes` (opcional)

Se possível, **anexe os arquivos de mídia** na ferramenta de IA para análise visual.

## Objetivo
1. Validar se a mídia está correta e legível.
2. Dizer **em qual item/card** a mídia deve aparecer.
3. Sugerir `caption`, `alt` (imagens) e `transcript` resumida (vídeos).
4. Apontar problemas: dados sensíveis, passo faltando, baixa legibilidade.

## Saída JSON
```json
{
  "package_id": "problemas-acesso",
  "analyst": "SEU_NOME",
  "placements": [
    {
      "item_id": "chunk-id",
      "asset_id": "vid-recuperar-senha",
      "approved": true,
      "placement": "after_first_sentence",
      "caption": "Como recuperar senha no portal",
      "alt": "",
      "transcript": "Resumo falado do vídeo em 2-3 frases",
      "issues": []
    }
  ]
}
```

Salve como `analysis_media_placement_SEU_NOME.json`.
