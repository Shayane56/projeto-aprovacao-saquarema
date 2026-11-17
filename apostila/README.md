# Apostila ACE · Saquarema 2027

Apostila ilustrada para o cargo 022 – Agente de Combate às Endemias
(Processo Seletivo Público nº 001/2026 · Prefeitura de Saquarema/RJ · banca IBAM).

O PDF pronto fica em **`saida/Apostila-ACE-Saquarema.pdf`**.

## Como gerar o PDF

```bash
cd apostila
node scripts/build.cjs                # gera saida/Apostila-ACE-Saquarema.pdf
node scripts/build.cjs --previa 4,10  # também salva PNGs dessas páginas em saida/previa/
```

O build usa o Playwright (Chromium). Ele também confere se algum conteúdo passou do limite
da página: nesse caso, lista as páginas no final e termina com código 2.

## Organização

| Pasta | O que tem |
|---|---|
| `paginas/` | O conteúdo, um arquivo HTML por bloco, montados em **ordem alfabética**. |
| `ilustracoes/` | Ilustrações originais em SVG (desenhadas para esta apostila). |
| `ilustracoes/icones/` | Ícones do Lucide (licença ISC). |
| `estilos/apostila.css` | Identidade visual: cores, tipografia, caixas, tabelas, questões. |
| `fontes/` | Poppins, Inter e Caveat (licença SIL OFL), embutidas no PDF. |
| `scripts/build.cjs` | Monta o HTML, numera as páginas, gera o sumário e o PDF. |

### Numeração dos arquivos

- `00-capa.html`, `01-apresentacao.html` (onde fica o marcador `<!-- SUMARIO -->`)
- Capítulo 1 (Leishmanioses): `10-…` a `14-…`
- Próximos capítulos: `20-…`, `30-…`, e assim por diante, na ordem do edital.

## Convenções

- Cada página é uma `<section class="pagina">` em A4 (210 × 297 mm), com o conteúdo em `<div class="conteudo">`.
- `data-capitulo="1" data-titulo-capitulo="Leishmanioses"` → cabeçalho “Capítulo 1 · Leishmanioses”.
- `data-sumario="1.3 Título" data-nivel="2"` → entrada no sumário (nível 1 = capítulo).
- `class="sem-cabecalho"` → página sem cabeçalho e rodapé (capa e aberturas).
- `<span data-icone="nome"></span>` → ícone de `ilustracoes/icones/nome.svg`.
- `<div class="figura" data-svg="ilustracoes/x.svg"></div>` → ilustração embutida.
- Caixas: `definicao`, `pegadinha`, `dica`, `memorize`, `curiosidade`, `ace`; comparação certo × errado: `.ce`.
- Questões: `.questao` (fonte em `.fonte`; inéditas com `.fonte.inedita`) e gabarito em `.gabarito-item`.

## Fontes do conteúdo

Manuais e guias do Ministério da Saúde (Guia de Vigilância em Saúde; Manual de Vigilância e
Controle da Leishmaniose Visceral; Manual de Vigilância da Leishmaniose Tegumentar), normas
citadas no texto e questões reais de concursos de ACE do banco do aplicativo.
