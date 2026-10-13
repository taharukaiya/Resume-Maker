/** Minimal text PDF for parser tests; contains no real person's data. */
export function textPdf(
  lines: string[],
  link?: { label: string; url: string },
) {
  const escaped = lines.map((line) => line.replace(/([\\()])/g, "\\$1"));
  const stream = `BT /F1 10 Tf 40 750 Td ${escaped.map((line, i) => `${i ? "0 -12 Td " : ""}(${line}) Tj`).join("\n")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R ${link ? "/Annots [6 0 R]" : ""} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  if (link)
    objects.push(
      `<< /Type /Annot /Subtype /Link /Rect [40 740 250 762] /Contents (${link.label.replace(/([\\()])/g, "\\$1")}) /A << /S /URI /URI (${link.url.replace(/([\\()])/g, "\\$1")}) >> >>`,
    );
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf);
}
