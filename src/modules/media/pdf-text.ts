type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

/** Keep PDF reading order, but distinguish wrapped lines from paragraph gaps. */
export function positionedPageText(items: TextItem[]) {
  const lines: {
    text: string;
    x: number;
    y: number;
    end: number;
    height: number;
  }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const x = item.transform[4],
      y = item.transform[5];
    const height =
      Math.abs(item.height) ||
      Math.hypot(item.transform[2], item.transform[3]) ||
      10;
    const previous = lines.at(-1);
    if (
      previous &&
      Math.abs(previous.y - y) < Math.min(height, previous.height) * 0.3
    ) {
      const separator =
        x - previous.end > height * 0.15 && !/\s$/.test(previous.text)
          ? " "
          : "";
      previous.text += separator + item.str;
      previous.end = x + item.width;
      previous.height = Math.max(previous.height, height);
    } else {
      lines.push({ text: item.str, x, y, end: x + item.width, height });
    }
  }
  // Estimate normal line spacing from the lower half of same-size adjacent lines.
  // This accommodates both single- and double-spaced documents without treating
  // every visual line as a paragraph.
  const spacing = lines
    .slice(1)
    .flatMap((line, index) => {
      const previous = lines[index],
        gap = previous.y - line.y;
      return Math.abs(line.height - previous.height) < 0.5 &&
        gap > line.height * 0.8 &&
        gap < line.height * 3
        ? [gap / line.height]
        : [];
    })
    .sort((a, b) => a - b);
  const normal = spacing.length
    ? spacing[Math.floor((spacing.length - 1) * 0.25)]
    : 1.2;
  return lines
    .map((line, index) => {
      if (!index) return line.text;
      const previous = lines[index - 1],
        gap = previous.y - line.y;
      const paragraph =
        gap >
          Math.max(line.height, previous.height) *
            Math.max(normal * 1.35, 1.65) || gap < -line.height;
      return (paragraph ? "\n\n" : "\n") + line.text;
    })
    .join("");
}

export async function extractPositionedText(bytes: Buffer, pageLimit: number) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    verbosity: 0,
  });
  try {
    const document = await task.promise;
    const pages: { text: string }[] = [];
    for (
      let number = 1;
      number <= Math.min(document.numPages, pageLimit);
      number++
    ) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push({
        text: positionedPageText(content.items.filter((item) => "str" in item)),
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
