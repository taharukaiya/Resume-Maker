import { db } from "@/lib/db";
import { invariant } from "@/lib/errors";
import { getObject } from "@/lib/storage";
import { cvExtractionSchema } from "@/modules/portfolios/cv-import";
import OpenAI from "openai";
import { aiConfig } from "@/modules/ai/config";
import { zodTextFormat } from "openai/helpers/zod";
import { generateWithGemini } from "@/modules/ai/gemini";
import { cvInstructions, validateCv } from "@/modules/ai/documents";
import { readPdfLinkEvidence } from "@/modules/ai/pdf";

export async function generateCvImport(job: {
  id: string;
  site_id: string;
  lease_id: string;
  payload: Record<string, unknown>;
}) {
  invariant(
    aiConfig().server,
    503,
    "Configure a server AI provider and model to enable CV import.",
  );
  const database = await db();
  const [media] = await database.query<{
    storage_key: string;
    mime: string;
    filename: string;
  }>("SELECT storage_key,mime,filename FROM media WHERE id=$1 AND site_id=$2", [
    job.payload.mediaId,
    job.site_id,
  ]);
  invariant(
    media?.mime === "application/pdf",
    400,
    "Select a PDF CV or resume.",
  );
  const bytes = await getObject(media.storage_key);
  invariant(bytes, 404, "CV file not found.");
  let linkEvidence = "";
  let linkWarning = "";
  try {
    linkEvidence = await readPdfLinkEvidence(bytes);
  } catch {
    // Vision extraction may still read a scanned PDF. Never pretend links were inspected.
    linkWarning =
      "Embedded PDF links could not be inspected. Check social profile URLs against the original CV.";
  }
  const extracted =
    aiConfig().provider === "gemini"
      ? await generateWithGemini({
          bytes,
          linkEvidence,
          instructions: cvInstructions,
          schema: cvExtractionSchema,
          maxTokens: 14000,
        })
      : await (async () => {
          const client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 120000,
            maxRetries: 1,
          });
          const response = await client.responses.parse({
            model: process.env.OPENAI_MODEL!,
            store: false,
            max_output_tokens: 14000,
            instructions: cvInstructions,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_file",
                    filename: media.filename,
                    file_data: `data:application/pdf;base64,${bytes.toString("base64")}`,
                  },
                  {
                    type: "input_text",
                    text: `Extract the factual profile and academic records for administrator review.\n${linkEvidence}`,
                  },
                ],
              },
            ],
            text: {
              format: zodTextFormat(cvExtractionSchema, "cv_extraction"),
            },
          });
          invariant(
            response.status === "completed" && response.output_parsed,
            422,
            "The CV could not be fully extracted. Try a shorter, clearer PDF.",
          );
          return cvExtractionSchema.parse(response.output_parsed);
        })();
  // Apply the same complete portfolio constraints for every provider before storage.
  const result = validateCv(extracted);
  if (linkWarning) result.warnings.push(linkWarning);
  await database.transaction(async (tx) => {
    const current = await tx.query(
      "SELECT id FROM jobs WHERE id=$1 AND lease_id=$2 AND status='running' FOR UPDATE",
      [job.id, job.lease_id],
    );
    invariant(current.length, 409, "Job lease expired.");
    await tx.query("UPDATE media SET cv_import=$1 WHERE id=$2 AND site_id=$3", [
      JSON.stringify(result),
      job.payload.mediaId,
      job.site_id,
    ]);
  });
}
