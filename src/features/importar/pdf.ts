/**
 * Extrai o texto de um PDF no próprio navegador (nada é enviado a servidores).
 * Detecta provas em duas colunas e lê a coluna da esquerda antes da direita.
 */
export async function extrairTextoDoPdf(arquivo: File, aoProgredir?: (pagina: number, total: number) => void): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const { width } = pagina.getViewport({ scale: 1 });
    const conteudo = await pagina.getTextContent();
    const itens = conteudo.items
      .filter((i): i is { str: string; transform: number[]; width: number } & typeof i => 'str' in i && i.str.trim() !== '')
      .map((i) => ({ texto: i.str, x: i.transform[4], y: i.transform[5], largura: i.width }));

    const meio = width / 2;
    const esquerda = itens.filter((i) => i.x < meio - 10 && i.x + i.largura <= meio + 15);
    const direita = itens.filter((i) => i.x >= meio - 10);
    const duasColunas = esquerda.length > itens.length * 0.25 && direita.length > itens.length * 0.25;
    const grupos = duasColunas ? [itens.filter((i) => !direita.includes(i)), direita] : [itens];
    paginas.push(grupos.map(montarLinhas).join('\n'));
    aoProgredir?.(n, doc.numPages);
  }
  return paginas.join('\n');
}

function montarLinhas(itens: { texto: string; x: number; y: number }[]): string {
  const ordenados = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: { y: number; partes: { x: number; texto: string }[] }[] = [];
  for (const it of ordenados) {
    const linha = linhas.find((l) => Math.abs(l.y - it.y) < 3);
    if (linha) linha.partes.push({ x: it.x, texto: it.texto });
    else linhas.push({ y: it.y, partes: [{ x: it.x, texto: it.texto }] });
  }
  return linhas
    .map((l) => l.partes.sort((a, b) => a.x - b.x).map((p) => p.texto).join(' ').replace(/\s+/g, ' ').trim())
    .join('\n');
}
