import { getDocument, OPS, Util } from "pdfjs-dist/legacy/build/pdf.mjs";

type Box = { x: number; y: number; right: number; bottom: number };
type Line = Box & { text: string; height: number };
type Figure = Box & { name: string };
const resourceKey = (name: string) => name.replace(/\bd\d+_/g, "");

/** Match labelled captions geometrically, never by the order text was extracted. */
export function matchFigureCaptions(figures: Figure[], lines: Line[]) {
  const sorted = [...lines].sort((a, b) => a.y - b.y || a.x - b.x);
  const captions = sorted.flatMap((line, index) => {
    if (
      !/^(?:fig(?:ure)?\.?|image|photo(?:graph)?|plate)\s*\d+[a-z]?(?:[.:)\s–—-]|$)/i.test(
        line.text.trim(),
      )
    )
      return [];
    let text = line.text.trim(),
      bottom = line.bottom;
    for (const next of sorted.slice(index + 1, index + 5)) {
      if (next.y < bottom - 2) continue;
      if (
        next.y - bottom > line.height * 0.7 ||
        Math.abs(next.x - line.x) > 12 ||
        Math.abs(next.height - line.height) > 1 ||
        /^(?:fig(?:ure)?\.?|image|photo|plate)\s*\d/i.test(next.text)
      )
        break;
      text += " " + next.text.trim();
      bottom = next.bottom;
    }
    return [{ ...line, bottom, text: text.slice(0, 2000) }];
  });
  const candidates = figures.map((figure) =>
    captions
      .flatMap((caption, index) => {
        const overlap =
          Math.min(figure.right, caption.right) - Math.max(figure.x, caption.x);
        if (
          overlap <
          Math.min(figure.right - figure.x, caption.right - caption.x) * 0.5
        )
          return [];
        const below = caption.y - figure.bottom,
          above = figure.y - caption.bottom;
        const gap =
          below >= -2
            ? Math.max(0, below)
            : above >= -2
              ? Math.max(0, above) + 12
              : Infinity;
        return gap <= 48 ? [{ index, gap }] : [];
      })
      .sort((a, b) => a.gap - b.gap),
  );
  const result: Record<string, string> = {};
  figures.forEach((figure, i) => {
    const best = candidates[i][0];
    if (!best || (candidates[i][1] && candidates[i][1].gap - best.gap < 8))
      return;
    if (
      candidates.some(
        (other, j) =>
          j !== i &&
          other.some((c) => c.index === best.index && c.gap <= best.gap + 8),
      )
    )
      return;
    if (figures.filter((f) => f.name === figure.name).length !== 1) return;
    result[resourceKey(figure.name)] = captions[best.index].text;
  });
  return result;
}

export async function extractFigureCaptions(bytes: Buffer, limit: number) {
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    verbosity: 0,
  });
  const pages: Record<string, string>[] = [];
  try {
    const doc = await task.promise;
    for (let n = 1; n <= Math.min(limit, doc.numPages); n++) {
      const page = await doc.getPage(n),
        viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent(),
        lines: Line[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [x, y] = viewport.convertToViewportPoint(
          item.transform[4],
          item.transform[5],
        );
        const height = Math.abs(item.height) || 10;
        const prior = lines.at(-1);
        if (
          prior &&
          Math.abs(prior.bottom - y) < 2 &&
          x - prior.right >= -2 &&
          x - prior.right < height * 2
        ) {
          prior.text += " " + item.str;
          prior.right = x + item.width;
        } else
          lines.push({
            x,
            y: y - height,
            right: x + item.width,
            bottom: y,
            height,
            text: item.str,
          });
      }
      const ops = await page.getOperatorList(),
        figures: Figure[] = [];
      let matrix = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const op = ops.fnArray[i],
          args = ops.argsArray[i];
        if (op === OPS.save) stack.push([...matrix]);
        else if (op === OPS.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
        else if (op === OPS.transform) matrix = Util.transform(matrix, args);
        else if (op === OPS.paintImageXObject && typeof args[0] === "string") {
          const transform = Util.transform(viewport.transform, matrix);
          const corners = [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ].map(([x, y]) => [
            transform[0] * x + transform[2] * y + transform[4],
            transform[1] * x + transform[3] * y + transform[5],
          ]);
          figures.push({
            name: args[0],
            x: Math.min(...corners.map((p) => p[0])),
            right: Math.max(...corners.map((p) => p[0])),
            y: Math.min(...corners.map((p) => p[1])),
            bottom: Math.max(...corners.map((p) => p[1])),
          });
        }
      }
      pages.push(matchFigureCaptions(figures, lines));
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
export function captionForResource(
  captions: Record<string, string> | undefined,
  name: string,
) {
  return captions?.[resourceKey(name)] || "";
}
