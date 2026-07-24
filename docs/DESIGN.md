# DESIGN - CRM Univesp

Este é o documento canônico de design para futuras atualizações do CRM Univesp.

## Princípio

O CRM Univesp deve parecer um canal institucional de orientação e operação acadêmica, não uma ferramenta genérica de chamados, nem uma demonstração de construção do sistema.

O usuario final deve ver apenas:

- estado atual;
- próximo passo;
- responsavel/canal;
- prazo esperado quando houver;
- acao possivel.

Textos, cards ou labels que explicam a arquitetura do produto, o protótipo, o shell, o blueprint ou a jornada interna devem ser removidos da interface final.

## Referências

- Manual de Identidade Visual Univesp v2.0, abril de 2022.
- Materiais oficiais de marca: `https://univesp.br/institucional/marca`.
- Referência visual publicada: `https://guiamatricula.univesp.br/`.
- Site institucional Univesp: `https://univesp.br/`.
- WCAG 2.2 W3C: `https://www.w3.org/TR/WCAG22/`.
- WAI/WCAG Quick Reference: `https://www.w3.org/WAI/WCAG22/quickref/`.
- WAI Easy Checks: `https://www.w3.org/WAI/test-evaluate/preliminary/`.

## Identidade Institucional

- Usar marca oficial Univesp, nunca texto decorativo substituindo o logo.
- Usar `Univesp` na grafia comum; `UNIVESP` somente quando o contexto institucional ja exigir caixa alta.
- Nao usar o simbolo isolado como assinatura principal.
- Nao recolorir, distorcer, aplicar sombra ou filtro no logo.
- Manter tom institucional, academico, claro, estavel e acessivel.

## Governo do Estado de São Paulo

O CRM deve considerar o padrao institucional visto no site `https://univesp.br/`:

- link de pulo para conteudo no topo;
- cabeçalho/barra do Governo do Estado de São Paulo;
- links institucionais e sociais quando aplicavel;
- area de controles de acessibilidade;
- rodape institucional quando a tela for publica ou de entrada.

Na fase inicial, os assets do Governo SP devem ficar versionados em `univesp-frontend/public/brand/gov/`. A implementação do cabeçalho/rodapé deve ser feita em fase própria, porque afeta o shell global.

## Ferramentas de acessibilidade

O site institucional Univesp exibe uma barra com recursos de acessibilidade. O CRM deve planejar equivalentes ou compatibilidade com:

- aumentar texto;
- diminuir texto;
- escala de cinza;
- alto contraste;
- contraste negativo;
- luz/cor de fundo;
- fonte legivel;
- redefinir ajustes.

Esses recursos devem complementar, nao substituir, uma interface ja acessivel por padrao.

## Acessibilidade W3C/WCAG

Alvo minimo: WCAG 2.2 nivel AA.

Requisitos obrigatorios:

- contraste minimo AA em texto, controles e estados;
- foco visivel e consistente;
- navegacao completa por teclado;
- ordem de foco equivalente a leitura visual;
- leitor de tela com landmarks, titulos, labels e regioes compreensiveis;
- todo botao icon-only com nome acessivel;
- imagens com `alt` adequado ou `alt=""` quando decorativas;
- alertas e estados dinamicos com `role="alert"`, `role="status"` ou `aria-live` quando necessario;
- zoom ate 200% sem perda de conteudo ou funcao;
- reducao de zoom sem alvos pequenos demais;
- dark mode sem perda de contraste ou significado;
- modo de leitura/dilexia com maior line-height, word-spacing e largura de linha controlada;
- informacao nunca depender apenas de cor.

## Leitores de Tela

Toda tela critica deve ser validada para leitores de tela.

Padrao esperado:

- um H1 claro por tela;
- headings em ordem logica;
- landmarks (`header`, `nav`, `main`, `footer`) quando aplicaveis;
- botoes e links com nomes que descrevem a acao;
- campos com label visivel ou nome acessivel equivalente;
- mensagens de erro associadas ao campo;
- updates de estado anunciados sem roubar foco indevidamente;
- tabelas com cabecalhos reais quando exibirem dados tabulares.

Evitar:

- texto visual sem equivalente semantico;
- botao com apenas icone sem `aria-label`;
- `div` clicavel sem papel semantico;
- `tabindex` positivo;
- ordem de DOM diferente da ordem visual.

## Português, Acentuação e Linguagem

Todo texto de interface final deve usar português brasileiro com acentuação correta.

Regras:

- Usar `matrícula`, `solicitação`, `orientação`, `próximo passo`, `responsável`, `área`, `protocolo`, `dúvida`, `histórico`, `permissões`, `publicação`.
- Não entregar textos finais sem acentos por limitação técnica.
- Evitar jargão interno quando houver palavra simples.
- Evitar caixa alta longa.
- Evitar frases que prometam resolucao quando o CRM apenas orienta, registra ou encaminha.
- Mensagens de erro devem informar o que fazer agora.
- Para aluno, escrever em linguagem direta e acolhedora, sem infantilizar.
- Para OP/secretario, escrever com precisao operacional e proxima acao clara.
- Para gestor, priorizar excecao, risco e decisao.
- Para admin, preservar governanca, validacao e impacto da publicacao.

## Cores

| Uso | HEX |
| --- | --- |
| Vermelho institucional | `#D13239` |
| Vermelho hover/enfase | `#AF1C27` |
| Cinza institucional | `#808285` |
| Texto secundario | `#607989` |
| Texto principal | `#172833` |
| Preto | `#000000` |
| Branco | `#FFFFFF` |
| Fundo | `#EBF1F2` |
| Borda sutil | `#C4D1D6` |

Usar vermelho com parcimonia. Texto longo nao deve ser vermelho. Estados semanticos precisam manter contraste AA.

## Tipografia

- Corpo e UI: Open Sans, fallback Arial.
- Titulos: Barlow, fallback Trebuchet MS.
- Nao usar tamanho baseado em viewport.
- Nao usar texto justificado.
- Nao usar `letter-spacing` negativo.
- Evitar espacamento excessivo em labels.
- Linhas longas devem ficar em torno de 60 a 72 caracteres quando houver leitura prolongada.

## Layout

- Design simples, leve e intuitivo.
- Desktop com conteudo principal proximo de 1200px, exceto telas operacionais densas.
- Mobile linear, sem depender de hover.
- Espacamento em multiplos de 8px.
- Radius: 4px para controles; ate 8px para cards e paineis.
- Sombras discretas ou ausentes.
- Remover blobs, gradientes decorativos e cards que nao ajudam a decisao.
- Uma acao primaria por contexto.

## Componentes base

A migracao deve usar classes/tokens em vez de hardcoded:

- `.crm-page`
- `.crm-page-wide`
- `.crm-page-header`
- `.crm-page-title`
- `.crm-panel`
- `.crm-card`
- `.crm-card-muted`
- `.crm-button-primary`
- `.crm-button-secondary`
- `.crm-field`
- `.crm-chip`
- `.crm-brand-mark`
- `.a11y-readable`
- `.a11y-dyslexia`
- `.a11y-zoom-lg`
- `.a11y-zoom-xl`
- `.a11y-high-contrast`

## Diretrizes por perfil

### Aluno

- Mostrar estado atual, proximo passo, canal correto e prazo esperado.
- Priorizar autosservico guiado.
- Remover textos que expliquem a construcao da jornada.
- Remover cards laterais que apenas repetem a tela.

### OP e secretario

- Priorizar triagem rapida e decisao segura.
- Mostrar SLA, prioridade, responsavel, historico e proxima acao.
- Remover textos de prototipo ou mecanica interna.

### Area responsavel

- Trabalhar por fila qualificada, prioridade e SLA.
- Manter rastreabilidade e devolutiva.

### Gestor

- Atuar por excecao: risco, volume anormal, gargalo e reincidencia.
- Evitar expor demanda bruta como centro da experiencia.

### Admin e FAQ Builder

- Poderoso, mas progressivo.
- Publicacao com validacao, revisao e previsao de impacto.
- Nao remover governanca para simplificar visual.

## Validacao antes de publicar

- Build passa.
- Lint escopado nos arquivos alterados passa ou pendencias antigas ficam registradas.
- Teste por teclado nas telas criticas.
- Verificacao com zoom 200%.
- Verificacao em dark mode.
- Verificacao de contraste.
- Verificacao de leitor de tela em pelo menos: login/acesso, aluno home, abertura de protocolo, fila OP e detalhe de caso.
- Varredura de hardcoded visual restante:
  - `rounded-[`
  - `shadow-[`
  - `109,76,255`
  - `blur-3xl`
  - `tracking-[`
  - `hover:-translate-y`
