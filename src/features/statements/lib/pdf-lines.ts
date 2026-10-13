import { getDocumentProxy } from 'unpdf';

/**
 * Texto de un PDF reconstruido por líneas: agrupa los fragmentos por altura y
 * los ordena de izquierda a derecha, separando columnas con doble espacio.
 */
export async function pdfToLines(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data);
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows: { y: number; items: { x: number; w: number; s: string }[] }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, w: item.width, s: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      let line = '';
      let end = -Infinity;
      for (const it of row.items) {
        const gap = it.x - end;
        line += line ? (gap > 6 ? '  ' : gap > 0.8 ? ' ' : '') : '';
        line += it.s.trim();
        end = it.x + it.w;
      }
      lines.push(line);
    }
  }
  return lines;
}
