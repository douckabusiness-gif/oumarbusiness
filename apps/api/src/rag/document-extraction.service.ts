import mammoth from "mammoth";

type ExtractionInput = {
  filename: string;
  mimeType?: string;
  buffer: Buffer;
};

function isPdf(input: ExtractionInput) {
  return input.mimeType === "application/pdf" || input.filename.toLowerCase().endsWith(".pdf");
}

function isDocx(input: ExtractionInput) {
  return (
    input.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    input.filename.toLowerCase().endsWith(".docx")
  );
}

function isText(input: ExtractionInput) {
  return (
    input.mimeType?.startsWith("text/") ||
    /\.(txt|md|csv|json)$/i.test(input.filename)
  );
}

class DocumentExtractionService {
  async extractText(input: ExtractionInput) {
    if (isPdf(input)) {
      return this.extractPdfText(input.buffer);
    }

    if (isDocx(input)) {
      return this.extractDocxText(input.buffer);
    }

    if (isText(input)) {
      return input.buffer.toString("utf8");
    }

    throw new Error("format_non_supporte");
  }

  private async extractPdfText(buffer: Buffer) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) pages.push(text);
    }

    return pages.join("\n\n");
  }

  private async extractDocxText(buffer: Buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.replace(/\s+\n/g, "\n").trim();
  }
}

export const documentExtractionService = new DocumentExtractionService();
