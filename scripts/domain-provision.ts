import {
  CloudFrontClient,
  CreateDistributionCommand,
  CreateFunctionCommand,
  CreateOriginAccessControlCommand,
  CreateResponseHeadersPolicyCommand,
  GetDistributionCommand,
  PublishFunctionCommand,
} from "@aws-sdk/client-cloudfront";
import "dotenv/config";
import { config } from "../src/lib/config";
import { hash } from "../src/lib/crypto";
import { closeDb, db } from "../src/lib/db";
import { liveManifest } from "../src/modules/publishing/service";
const [hostname, certificateArn, mode] = process.argv.slice(2);
if (!hostname)
  throw new Error(
    "Usage: npm run domain:provision -- hostname ACM-certificate-ARN [activate]",
  );
if (
  (!process.env.DATABASE_URL && !process.env.DATABASE_SECRET_ARN) ||
  !config().publishBucket
)
  throw new Error(
    "Configure production PostgreSQL and S3 before provisioning a domain.",
  );
const database = await db();
try {
  const [domain] = await database.query<{
    id: string;
    site_id: string;
    verified_at: string | null;
    distribution_id: string | null;
    cdn_hostname: string | null;
    slug: string;
  }>(
    "SELECT d.*,s.slug FROM domains d JOIN sites s ON s.id=d.site_id WHERE d.hostname=$1",
    [hostname],
  );
  if (!domain?.verified_at)
    throw new Error(
      "Add this domain in the portfolio editor and verify its TXT record first.",
    );
  const client = new CloudFrontClient({});
  if (domain.distribution_id) {
    const response = await client.send(
      new GetDistributionCommand({ Id: domain.distribution_id }),
    );
    console.log(
      `CloudFront status: ${response.Distribution?.Status}. DNS target: ${domain.cdn_hostname}`,
    );
    if (mode === "activate") {
      if (response.Distribution?.Status !== "Deployed")
        throw new Error("Wait for CloudFront deployment before activating.");
      await database.query(
        "UPDATE domains SET activated_at=now() WHERE id=$1",
        [domain.id],
      );
      console.log(
        "Domain enabled for future releases. Republish this portfolio to use its custom domain in canonical URLs and navigation.",
      );
    }
    process.exitCode = 0;
  } else {
    if (!certificateArn?.startsWith("arn:aws:acm:us-east-1:"))
      throw new Error(
        "Provide an ISSUED ACM certificate ARN from us-east-1 that covers this hostname.",
      );
    if (!process.env.CLOUDFRONT_WAF_ARN)
      throw new Error("Set CLOUDFRONT_WAF_ARN to the global WAF ACL ARN.");
    const manifest = await liveManifest(domain.slug);
    if (!manifest)
      throw new Error(
        "Publish the portfolio once before provisioning its domain.",
      );
    const suffix = hash(hostname).slice(0, 12),
      stamp = Date.now();
    const oac = await client.send(
      new CreateOriginAccessControlCommand({
        OriginAccessControlConfig: {
          Name: `brilliancy-${suffix}-${stamp}`,
          OriginAccessControlOriginType: "s3",
          SigningBehavior: "always",
          SigningProtocol: "sigv4",
        },
      }),
    );
    const fn = await client.send(
      new CreateFunctionCommand({
        Name: `brilliancy-paths-${suffix}-${stamp}`,
        FunctionConfig: {
          Comment: "Map clean portfolio URLs to static HTML.",
          Runtime: "cloudfront-js-2.0",
        },
        FunctionCode: Buffer.from(
          'function handler(event) { var r=event.request; if(r.uri.endsWith("/")) r.uri+="index.html"; else if(r.uri.split("/").pop().indexOf(".")===-1) r.uri+="/index.html"; return r; }',
        ),
      }),
    );
    const functionName = fn.FunctionSummary?.Name;
    if (!functionName || !fn.ETag)
      throw new Error("Could not create URL rewrite function.");
    const published = await client.send(
      new PublishFunctionCommand({ Name: functionName, IfMatch: fn.ETag }),
    );
    const headers = await client.send(
      new CreateResponseHeadersPolicyCommand({
        ResponseHeadersPolicyConfig: {
          Name: `brilliancy-security-${suffix}-${stamp}`,
          SecurityHeadersConfig: {
            ContentSecurityPolicy: {
              ContentSecurityPolicy: `default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'none'; form-action ${new URL(config().appUrl).origin}; frame-ancestors 'none'; base-uri 'none'`,
              Override: true,
            },
            ContentTypeOptions: { Override: true },
            FrameOptions: { FrameOption: "DENY", Override: true },
            ReferrerPolicy: {
              ReferrerPolicy: "strict-origin-when-cross-origin",
              Override: true,
            },
            StrictTransportSecurity: {
              AccessControlMaxAgeSec: 31536000,
              IncludeSubdomains: true,
              Override: true,
            },
          },
        },
      }),
    );
    const distribution = await client.send(
      new CreateDistributionCommand({
        DistributionConfig: {
          CallerReference: `brilliancy-${domain.id}`,
          Comment: `Brilliancy portfolio ${domain.site_id}`,
          Enabled: true,
          IsIPV6Enabled: true,
          HttpVersion: "http2and3",
          DefaultRootObject: "index.html",
          Aliases: { Quantity: 1, Items: [hostname] },
          WebACLId: process.env.CLOUDFRONT_WAF_ARN,
          ViewerCertificate: {
            ACMCertificateArn: certificateArn,
            SSLSupportMethod: "sni-only",
            MinimumProtocolVersion: "TLSv1.2_2021",
          },
          Origins: {
            Quantity: 1,
            Items: [
              {
                Id: "portfolio",
                DomainName: `${config().publishBucket}.s3.${config().region}.amazonaws.com`,
                OriginPath: `/releases/${domain.site_id}/${manifest.releaseId}`,
                OriginAccessControlId: oac.OriginAccessControl?.Id,
                S3OriginConfig: { OriginAccessIdentity: "" },
              },
            ],
          },
          DefaultCacheBehavior: {
            TargetOriginId: "portfolio",
            ViewerProtocolPolicy: "redirect-to-https",
            Compress: true,
            AllowedMethods: {
              Quantity: 2,
              Items: ["GET", "HEAD"],
              CachedMethods: { Quantity: 2, Items: ["GET", "HEAD"] },
            },
            CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
            ResponseHeadersPolicyId: headers.ResponseHeadersPolicy?.Id,
            FunctionAssociations: {
              Quantity: 1,
              Items: [
                {
                  EventType: "viewer-request",
                  FunctionARN:
                    published.FunctionSummary?.FunctionMetadata?.FunctionARN,
                },
              ],
            },
          },
          PriceClass: "PriceClass_All",
        },
      }),
    );
    if (!distribution.Distribution?.Id)
      throw new Error("CloudFront did not return a distribution ID.");
    await database.query(
      "UPDATE domains SET distribution_id=$1,cdn_hostname=$2 WHERE id=$3",
      [
        distribution.Distribution.Id,
        distribution.Distribution.DomainName,
        domain.id,
      ],
    );
    console.log(
      `Created distribution ${distribution.Distribution.Id}. Point ${hostname} to ${distribution.Distribution.DomainName}.`,
    );
    console.log(
      "For an apex domain use a Route 53 ALIAS; for a subdomain use a CNAME. Wait for Deployed status, then run the same command with activate as its final argument.",
    );
  }
} finally {
  await closeDb();
}
