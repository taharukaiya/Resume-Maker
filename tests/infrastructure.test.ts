import { it, expect } from "vitest";
import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
it("synthesizes isolated storage, private Multi-AZ PostgreSQL, TLS, and a firewall", async () => {
  process.env.BRILLIANCY_INFRA_TEST = "true";
  const { BrilliancyStack, BrilliancyEdgeStack } = await import("../infra/app");
  const app = new App({ outdir: ".test-data/cdk" });
  const edge = new BrilliancyEdgeStack(app, "EdgeTest", "123456789012");
  const stack = new BrilliancyStack(app, "InfrastructureTest", {
    domain: "studio.integration.test",
    zoneId: "ZTEST123456789",
    zoneName: "integration.test",
    region: "ap-southeast-1",
    account: "123456789012",
    services: 0,
    edgeWafArn: edge.aclArn,
  });
  const template = Template.fromStack(stack);
  Template.fromStack(edge).hasResourceProperties("AWS::WAFv2::WebACL", {
    Scope: "CLOUDFRONT",
  });
  template.resourceCountIs("AWS::S3::Bucket", 2);
  template.hasResourceProperties("AWS::RDS::DBInstance", {
    MultiAZ: true,
    PubliclyAccessible: false,
    StorageEncrypted: true,
    DeletionProtection: true,
  });
  template.resourceCountIs("AWS::WAFv2::WebACL", 1);
  template.hasResourceProperties("AWS::ElasticLoadBalancingV2::Listener", {
    Protocol: "HTTPS",
  });
  template.hasResourceProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
  template.hasResourceProperties("AWS::ECS::TaskDefinition", {
    ContainerDefinitions: Match.arrayWith([
      Match.objectLike({
        Name: "Application",
        Environment: Match.arrayWith([
          { Name: "DATABASE_NAME", Value: "brilliancy" },
        ]),
      }),
    ]),
  });
  expect(JSON.stringify(template.toJSON())).not.toContain("browser-test-only");
});
