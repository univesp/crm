# Processador de mídia

Serviço privado Cloud Run que converte GIF em MP4 sem autoplay. Exige
`X-Media-Processor-Token`, limita o corpo a 25 MiB e remove os arquivos temporários
ao fim da requisição.
