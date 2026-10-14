import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: exec }));
import { wordExtension, wordToPdf } from "../src/modules/media/word";
describe("Private Word-to-PDF conversion", () => {
  beforeEach(() => {
    exec.mockReset();
  });
  it("requires a matching filename and detected Word type", () => {
    expect(
      wordExtension(
        "paper.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
    expect(wordExtension("paper.doc", "application/x-cfb")).toBe("doc");
    expect(wordExtension("paper.docx", "application/pdf")).toBeNull();
    expect(wordExtension("paper.exe", "application/x-cfb")).toBeNull();
  });
  it("uses a private macro-disabled profile, a timeout, literal arguments, and removes temporary files", async () => {
    let directory = "";
    exec.mockImplementation(
      (
        _bin: string,
        args: string[],
        options: Record<string, unknown>,
        callback: Function,
      ) => {
        directory = path.dirname(args.at(-1)!);
        expect(options.timeout).toBe(60000);
        expect(options.windowsHide).toBe(true);
        expect(args).toContain("pdf:writer_pdf_Export");
        void (async () => {
          const config = await readFile(
            path.join(directory, "profile/user/registrymodifications.xcu"),
            "utf8",
          );
          expect(config).toContain("MacroSecurityLevel");
          expect(config).toContain("<value>3</value>");
          await writeFile(
            path.join(directory, "article.pdf"),
            "%PDF-1.7\nconverted fixture",
          );
          callback(null, "", "");
        })();
      },
    );
    expect(
      (await wordToPdf(Buffer.from("fixture"), "docx"))
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
    await expect(
      readFile(path.join(directory, "article.docx")),
    ).rejects.toThrow();
  });
  it("rejects failed conversion and never exposes document paths or process output", async () => {
    exec.mockImplementation(
      (_bin: unknown, _args: unknown, _options: unknown, callback: Function) =>
        callback(
          Object.assign(new Error("private path / document content"), {
            code: "ENOENT",
          }),
        ),
    );
    await expect(wordToPdf(Buffer.from("fixture"), "doc")).rejects.toThrow(
      "Check LibreOffice on the server",
    );
  });
  it("rejects converter output that is not a PDF", async () => {
    exec.mockImplementation(
      (_bin: string, args: string[], _options: unknown, callback: Function) => {
        void writeFile(
          path.join(path.dirname(args.at(-1)!), "article.pdf"),
          "not a pdf",
        ).then(() => callback(null, "", ""));
      },
    );
    await expect(wordToPdf(Buffer.from("fixture"), "docx")).rejects.toThrow(
      "converted PDF is invalid",
    );
  });
});
