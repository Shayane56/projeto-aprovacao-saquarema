export type ItemGabarito = number | 'anulada';

/**
 * Lê gabaritos em vários formatos:
 * "01-A 02-C 03-B", "1 A 2 C", "1.a; 2.c", "ACBD...", e marca anuladas com X, *, "ANULADA" ou "NULA".
 */
export function lerGabarito(texto: string): Map<number, ItemGabarito> {
  const resultado = new Map<number, ItemGabarito>();
  const valor = (s: string): ItemGabarito | null => {
    const v = s.toUpperCase();
    if (/^(X|\*|ANULADA|NULA|ANULADO)$/.test(v)) return 'anulada';
    if (/^[A-E]$/.test(v)) return v.charCodeAt(0) - 65;
    return null;
  };

  const pares = [...texto.matchAll(/(\d{1,3})\s*[-–.:)=]?\s*(ANULADA|ANULADO|NULA|[A-Ea-e]|X|\*)(?![\p{L}])/giu)];
  if (pares.length >= 2) {
    for (const [, n, v] of pares) {
      const item = valor(v);
      if (item !== null) resultado.set(Number(n), item);
    }
    return resultado;
  }

  const sequencia = texto.toUpperCase().replace(/[^A-EX*]/g, '');
  [...sequencia].forEach((c, i) => {
    const item = valor(c);
    if (item !== null) resultado.set(i + 1, item);
  });
  return resultado;
}
