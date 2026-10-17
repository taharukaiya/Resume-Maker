import { extractLabeledMetadata } from "@/modules/media/article-metadata";
import {
  articleContent,
  cleanPrintArtifacts,
  cleanPdfPageText,
} from "@/modules/media/article-content";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { invariant } from "@/lib/errors";
import { aiConfig } from "@/modules/ai/config";
import {
  articleInstructions,
  articleMetadataSchema,
} from "@/modules/ai/article";
import { generateWithGemini } from "@/modules/ai/gemini";
import OpenAI from "openai";
import { z } from "zod";
import { entrySchema } from "@/modules/portfolios/schema";

export async function generateArticle(job: {
  id: string;
  site_id: string;
  lease_id: string;
  payload: Record<string, unknown>;
}) {
  invariant(
    aiConfig().server,
    503,
    "Configure a server AI provider to extract article details.",
  );
  const database = await db();
  const [file] = await database.query<{
    storage_key: string;
    mime: string;
    filename: string;
  }>("SELECT storage_key,mime,filename FROM media WHERE id=$1 AND site_id=$2", [
    job.payload.mediaId,
    job.site_id,
  ]);
  invariant(file?.mime === "application/pdf", 400, "Select a PDF article.");
  const bytes = await getObject(file.storage_key);
  invariant(bytes, 404, "Article file not found.");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  let text = "";
  try {
    text = cleanPdfPageText((await parser.getText({ pageJoiner: "" })).pages);
  } catch {
    /* Native PDF input can handle scanned articles. */
  } finally {
    await parser.destroy();
  }
  const usableText =
    text.trim().length >= 200 && text.length <= 240000
      ? cleanPrintArtifacts(text)
      : undefined;
  const metadata =
    aiConfig().provider === "gemini"
      ? await generateWithGemini({
          bytes,
          text: usableText,
          instructions: articleInstructions,
          schema: articleMetadataSchema,
          maxTokens: 6144,
        })
      : await (async () => {
          const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 120000,
            maxRetries: 1,
          });
          const schema = z.toJSONSchema(articleMetadataSchema);
          delete schema.$schema;
          const result = await client.responses.create({
            model: process.env.OPENAI_MODEL!,
            store: false,
            max_output_tokens: 6144,
            instructions: articleInstructions,
            input: usableText
              ? `<document>\n${usableText}\n</document>`
              : [
                  {
                    role: "user",
                    content: [
                      {
                        type: "input_file",
                        filename: file.filename,
                        file_data: `data:application/pdf;base64,${bytes.toString("base64")}`,
                      },
                      {
                        type: "input_text",
                        text: "Extract editable article details and its abstract.",
                      },
                    ],
                  },
                ],
            text: {
              format: {
                type: "json_schema",
                name: "article_metadata",
                strict: true,
                schema,
              },
            },
          });
          invariant(
            result.status === "completed",
            422,
            "AI did not finish a complete article proposal.",
          );
          return articleMetadataSchema.parse(JSON.parse(result.output_text));
        })();
  const labeled = extractLabeledMetadata(text);
  const originalAbstract = articleContent(text).abstract || labeled.abstract;
  if (originalAbstract) {
    metadata.abstract = originalAbstract;
    metadata.abstractSource = "original";
  }
  metadata.authors ||= labeled.authors;
  metadata.date ||= labeled.date;
  if (!metadata.abstract.trim())
    metadata.warnings.push(
      "No abstract could be extracted. Enter it manually before publishing.",
    );
  if (!metadata.authors.trim())
    metadata.warnings.push("Author names require manual review.");
  if (!metadata.date)
    metadata.warnings.push("Publication date requires manual review.");
  if (!entrySchema.shape.start.safeParse(metadata.date).success) {
    metadata.warnings.push(
      "The publication date could not be interpreted. Enter it manually.",
    );
    metadata.date = "";
  }
  if (text.length > 240000)
    metadata.warnings.push(
      "The displayed article text is limited to 240,000 characters. The downloadable PDF contains the full document.",
    );
  const model =
    aiConfig().provider === "gemini"
      ? process.env.GEMINI_MODEL
      : process.env.OPENAI_MODEL;
  await database.transaction(async (tx) => {
    const lease = await tx.query(
      "SELECT id FROM jobs WHERE id=$1 AND lease_id=$2 AND status='running' FOR UPDATE",
      [job.id, job.lease_id],
    );
    invariant(lease.length, 409, "Job lease expired.");
    await tx.query(
      "UPDATE media SET extracted_text=$1,article_metadata=$2,summary=$3 WHERE id=$4 AND site_id=$5",
      [
        text.slice(0, 240000),
        JSON.stringify(metadata),
        JSON.stringify({
          abstract: metadata.abstract,
          keywords: metadata.keywords,
          limitations: metadata.warnings.join(" "),
          model,
          generatedAt: new Date().toISOString(),
        }),
        job.payload.mediaId,
        job.site_id,
      ],
    );
  });
}
