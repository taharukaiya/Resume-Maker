#!/usr/bin/env node
import "dotenv/config";
import {
  App,
  Stack,
  Duration,
  RemovalPolicy,
  CfnOutput,
  Tags,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_ecs_patterns as patterns,
  aws_rds as rds,
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_certificatemanager as acm,
  aws_secretsmanager as secrets,
  aws_iam as iam,
  aws_logs as logs,
  aws_wafv2 as waf,
  aws_ses as ses,
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import path from "node:path";
export type DeploymentConfig = {
  domain: string;
  zoneId: string;
  zoneName: string;
  region: string;
  account?: string;
  services: number;
  aiSecretArn?: string;
  edgeWafArn?: string;
};
export class BrilliancyStack extends Stack {
  constructor(scope: Construct, id: string, cfg: DeploymentConfig) {
    super(scope, id, {
      env: { account: cfg.account, region: cfg.region },
      crossRegionReferences: true,
    });
    Tags.of(this).add("Application", "BrilliancyResearch");
    const vpc = new ec2.Vpc(this, "Network", {
      maxAzs: 2,
      natGateways: 2,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: "application",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: "database",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });
    vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });
    const appSecurity = new ec2.SecurityGroup(this, "AppSecurity", {
      vpc,
      description: "Private application tasks",
    });
    const database = new rds.DatabaseInstance(this, "Database", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17,
      }),
      credentials: rds.Credentials.fromGeneratedSecret("brilliancy_migrations"),
      databaseName: "brilliancy",
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MEDIUM,
      ),
      multiAz: true,
      allocatedStorage: 30,
      maxAllocatedStorage: 200,
      storageEncrypted: true,
      backupRetention: Duration.days(14),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      publiclyAccessible: false,
      cloudwatchLogsExports: ["postgresql"],
      autoMinorVersionUpgrade: true,
    });
    database.connections.allowDefaultPortFrom(appSecurity);
    const appDatabaseSecret = new secrets.Secret(
      this,
      "ApplicationDatabaseCredentials",
      {
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: "brilliancy_app" }),
          generateStringKey: "password",
          passwordLength: 48,
          excludePunctuation: true,
        },
        removalPolicy: RemovalPolicy.RETAIN,
      },
    );
    const sessionSecret = new secrets.Secret(this, "SessionEncryptionKey", {
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const setupSecret = new secrets.Secret(this, "SetupToken", {
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const bucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    };
    const privateBucket = new s3.Bucket(this, "PrivateFiles", bucketProps);
    const publicBucket = new s3.Bucket(this, "PublishedFiles", bucketProps);
    const assetGuard = new cloudfront.Function(this, "AssetPathGuard", {
      code: cloudfront.FunctionCode.fromInline(
        'function handler(event) { var r=event.request; if (!/^\\/releases\\/[a-f0-9-]+\\/[a-f0-9-]+\\/assets\\/[a-f0-9-]+\\.(webp|pdf)$/.test(r.uri)) return {statusCode:403,statusDescription:"Forbidden"}; return r; }',
      ),
    });
    const assets = new cloudfront.Distribution(this, "PublicAssets", {
      webAclId: cfg.edgeWafArn,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(publicBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          {
            function: assetGuard,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
    });
    // Custom-domain distributions are created later. They can read published files only.
    publicBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [publicBucket.arnForObjects("releases/*")],
        conditions: {
          StringLike: {
            "AWS:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/*`,
          },
        },
      }),
    );
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: cfg.zoneId,
      zoneName: cfg.zoneName,
    });
    const certificate = new acm.Certificate(this, "StudioCertificate", {
      domainName: cfg.domain,
      validation: acm.CertificateValidation.fromDns(zone),
    });
    new ses.EmailIdentity(this, "EmailIdentity", {
      identity: ses.Identity.publicHostedZone(zone),
    });
    const logGroup = new logs.LogGroup(this, "ApplicationLogs", {
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const image = ecs.ContainerImage.fromAsset(path.resolve("."), {
      exclude: [
        "node_modules",
        ".next",
        ".git",
        ".data",
        ".test-data",
        "test-results",
        "playwright-report",
        "cdk.out",
        ".env",
        ".env.local",
      ],
    });
    const environment = {
      APP_URL: `https://${cfg.domain}`,
      AWS_REGION: cfg.region,
      DATABASE_HOST: database.dbInstanceEndpointAddress,
      DATABASE_NAME: "brilliancy",
      DATABASE_SECRET_ARN: appDatabaseSecret.secretArn,
      S3_BUCKET: privateBucket.bucketName,
      PUBLIC_BUCKET: publicBucket.bucketName,
      PUBLIC_ASSET_URL: `https://${assets.distributionDomainName}`,
      EMAIL_FROM: `Brilliancy Research <noreply@${cfg.zoneName}>`,
      CLAMAV_HOST: "127.0.0.1",
      CLAMAV_PORT: "3310",
      RUN_WORKER: "false",
      NODE_ENV: "production",
      NODE_EXTRA_CA_CERTS: "/app/rds-ca.pem",
      CLOUDFRONT_WAF_ARN: cfg.edgeWafArn || "",
    };
    const secretValues: Record<string, ecs.Secret> = {
      SESSION_SECRET: ecs.Secret.fromSecretsManager(sessionSecret),
      SETUP_TOKEN: ecs.Secret.fromSecretsManager(setupSecret),
    };
    if (cfg.aiSecretArn) {
      const ai = secrets.Secret.fromSecretCompleteArn(
        this,
        "AiCredentials",
        cfg.aiSecretArn,
      );
      secretValues.OPENAI_API_KEY = ecs.Secret.fromSecretsManager(ai, "apiKey");
      secretValues.OPENAI_MODEL = ecs.Secret.fromSecretsManager(ai, "model");
    }
    const createTask = (
      name: string,
      command?: string[],
      migration = false,
    ) => {
      const task = new ecs.FargateTaskDefinition(this, name, {
        cpu: 1024,
        memoryLimitMiB: 4096,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      });
      task.addContainer("Application", {
        image,
        command,
        environment: migration
          ? {
              ...environment,
              DATABASE_SECRET_ARN: database.secret!.secretArn,
              APPLICATION_DATABASE_SECRET_ARN: appDatabaseSecret.secretArn,
            }
          : environment,
        secrets: secretValues,
        logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: name }),
        portMappings: [{ containerPort: 3000 }],
        memoryReservationMiB: 1024,
      });
      if (!migration) {
        const scanner = task.addContainer("Scanner", {
          image: ecs.ContainerImage.fromRegistry("clamav/clamav:1.4"),
          essential: true,
          memoryReservationMiB: 2048,
          logging: ecs.LogDrivers.awsLogs({
            logGroup,
            streamPrefix: `${name}-scanner`,
          }),
          healthCheck: {
            command: ["CMD-SHELL", "clamdcheck.sh"],
            interval: Duration.seconds(30),
            timeout: Duration.seconds(10),
            retries: 5,
            startPeriod: Duration.seconds(180),
          },
        });
        task.defaultContainer!.addContainerDependencies({
          container: scanner,
          condition: ecs.ContainerDependencyCondition.HEALTHY,
        });
      }
      appDatabaseSecret.grantRead(task.taskRole);
      if (migration) {
        database.secret!.grantRead(task.taskRole);
      } else {
        privateBucket.grantReadWrite(task.taskRole);
        publicBucket.grantReadWrite(task.taskRole);
        task.addToTaskRolePolicy(
          new iam.PolicyStatement({
            actions: ["ses:SendEmail"],
            resources: [
              `arn:aws:ses:${cfg.region}:${this.account}:identity/${cfg.zoneName}`,
            ],
            conditions: {
              StringEquals: { "ses:FromAddress": `noreply@${cfg.zoneName}` },
            },
          }),
        );
        task.addToTaskRolePolicy(
          new iam.PolicyStatement({
            actions: [
              "cloudfront:GetDistributionConfig",
              "cloudfront:UpdateDistribution",
              "cloudfront:CreateInvalidation",
            ],
            resources: [`arn:aws:cloudfront::${this.account}:distribution/*`],
          }),
        );
      }
      return task;
    };
    const webTask = createTask("WebTask");
    const web = new patterns.ApplicationLoadBalancedFargateService(
      this,
      "Studio",
      {
        cluster,
        taskDefinition: webTask,
        desiredCount: Math.max(1, cfg.services),
        certificate,
        domainName: cfg.domain,
        domainZone: zone,
        redirectHTTP: true,
        publicLoadBalancer: true,
        assignPublicIp: false,
        securityGroups: [appSecurity],
        taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        healthCheckGracePeriod: Duration.minutes(6),
        circuitBreaker: { rollback: true },
      },
    );
    (web.service.node.defaultChild as ecs.CfnService).desiredCount =
      cfg.services;
    web.targetGroup.configureHealthCheck({
      path: "/api/status",
      healthyHttpCodes: "200",
      interval: Duration.seconds(30),
      timeout: Duration.seconds(10),
    });
    const workerTask = createTask("WorkerTask", [
      "node",
      "--import",
      "tsx",
      "scripts/worker.ts",
    ]);
    const worker = new ecs.FargateService(this, "Worker", {
      cluster,
      taskDefinition: workerTask,
      desiredCount: cfg.services ? 1 : 0,
      assignPublicIp: false,
      securityGroups: [appSecurity],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      circuitBreaker: { rollback: true },
    });
    const migrationTask = createTask(
      "MigrationTask",
      ["node", "--import", "tsx", "scripts/migrate.ts"],
      true,
    );
    const operatorTask = new ecs.FargateTaskDefinition(
      this,
      "DomainOperatorTask",
      { cpu: 512, memoryLimitMiB: 1024 },
    );
    operatorTask.addContainer("Application", {
      image,
      command: ["node", "--import", "tsx", "scripts/domain-provision.ts"],
      environment,
      secrets: secretValues,
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: "DomainOperator",
      }),
    });
    appDatabaseSecret.grantRead(operatorTask.taskRole);
    privateBucket.grantRead(operatorTask.taskRole);
    operatorTask.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudfront:CreateDistribution",
          "cloudfront:GetDistribution",
          "cloudfront:ListDistributions",
          "cloudfront:CreateFunction",
          "cloudfront:PublishFunction",
          "cloudfront:CreateOriginAccessControl",
          "cloudfront:CreateResponseHeadersPolicy",
        ],
        resources: ["*"],
      }),
    );
    new CfnOutput(this, "DomainOperatorTaskArn", {
      value: operatorTask.taskDefinitionArn,
    });
    const acl = new waf.CfnWebACL(this, "StudioFirewall", {
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: "BrilliancyStudio",
      },
      rules: [
        {
          name: "CommonThreats",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
              ruleActionOverrides: [
                { name: "SizeRestrictions_BODY", actionToUse: { count: {} } },
                { name: "CrossSiteScripting_BODY", actionToUse: { count: {} } },
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
            metricName: "CommonThreats",
          },
        },
        {
          name: "RequestRate",
          priority: 2,
          action: { block: {} },
          statement: {
            rateBasedStatement: { aggregateKeyType: "IP", limit: 2000 },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
            metricName: "RequestRate",
          },
        },
      ],
    });
    new waf.CfnWebACLAssociation(this, "FirewallAssociation", {
      resourceArn: web.loadBalancer.loadBalancerArn,
      webAclArn: acl.attrArn,
    });
    new CfnOutput(this, "StudioUrl", { value: `https://${cfg.domain}` });
    new CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new CfnOutput(this, "WebServiceName", { value: web.service.serviceName });
    new CfnOutput(this, "WorkerServiceName", { value: worker.serviceName });
    new CfnOutput(this, "MigrationTaskArn", {
      value: migrationTask.taskDefinitionArn,
    });
    new CfnOutput(this, "ApplicationSecurityGroup", {
      value: appSecurity.securityGroupId,
    });
    new CfnOutput(this, "PrivateSubnetIds", {
      value: vpc.privateSubnets.map((s) => s.subnetId).join(","),
    });
    new CfnOutput(this, "SetupTokenSecretArn", {
      value: setupSecret.secretArn,
    });
    new CfnOutput(this, "PrivateBucket", { value: privateBucket.bucketName });
    new CfnOutput(this, "PublicBucket", { value: publicBucket.bucketName });
    new CfnOutput(this, "PublicAssetUrl", {
      value: `https://${assets.distributionDomainName}`,
    });
    new CfnOutput(this, "DatabaseHost", {
      value: database.dbInstanceEndpointAddress,
    });
    new CfnOutput(this, "ApplicationDatabaseSecretArn", {
      value: appDatabaseSecret.secretArn,
    });
  }
}
export class BrilliancyEdgeStack extends Stack {
  public readonly aclArn: string;
  constructor(scope: Construct, id: string, account?: string) {
    super(scope, id, {
      env: { account, region: "us-east-1" },
      crossRegionReferences: true,
    });
    const acl = new waf.CfnWebACL(this, "PublicFirewall", {
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
        metricName: "BrilliancyPublic",
      },
      rules: [
        {
          name: "PublicRateLimit",
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: { aggregateKeyType: "IP", limit: 2000 },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
            metricName: "PublicRateLimit",
          },
        },
      ],
    });
    this.aclArn = acl.attrArn;
    new CfnOutput(this, "PublicWafArn", { value: this.aclArn });
  }
}
if (!process.env.BRILLIANCY_INFRA_TEST) {
  const app = new App();
  for (const key of ["BRILLIANCY_DOMAIN", "HOSTED_ZONE_ID", "HOSTED_ZONE_NAME"])
    if (!process.env[key])
      throw new Error(
        `Set ${key} before synthesizing or deploying. See docs/DEPLOYMENT.md.`,
      );
  const edge = new BrilliancyEdgeStack(
    app,
    "BrilliancyEdge",
    process.env.CDK_DEFAULT_ACCOUNT,
  );
  new BrilliancyStack(app, "BrilliancyResearch", {
    domain: process.env.BRILLIANCY_DOMAIN!,
    zoneId: process.env.HOSTED_ZONE_ID!,
    zoneName: process.env.HOSTED_ZONE_NAME!,
    region: process.env.AWS_REGION || "ap-southeast-1",
    account: process.env.CDK_DEFAULT_ACCOUNT,
    services: Number(app.node.tryGetContext("services") || 0),
    aiSecretArn: process.env.AI_SECRET_ARN,
    edgeWafArn: edge.aclArn,
  });
}
