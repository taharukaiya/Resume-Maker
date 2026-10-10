param([int]$WebCount = 2)
$ErrorActionPreference = 'Stop'
foreach ($requiredName in @('BRILLIANCY_DOMAIN','HOSTED_ZONE_ID','HOSTED_ZONE_NAME','AWS_REGION')) {
  if (-not [Environment]::GetEnvironmentVariable($requiredName)) { throw "Set $requiredName first. See docs/DEPLOYMENT.md." }
}
New-Item -ItemType Directory -Force -Path '.data' | Out-Null
npm.cmd run infra:deploy -- --outputs-file .data/aws-outputs.json
if ($LASTEXITCODE -ne 0) { throw 'Infrastructure deployment did not complete.' }
$deployment = (Get-Content -LiteralPath '.data/aws-outputs.json' -Raw | ConvertFrom-Json).BrilliancyResearch
$runInput = @{
  cluster = $deployment.ClusterName
  taskDefinition = $deployment.MigrationTaskArn
  launchType = 'FARGATE'
  networkConfiguration = @{ awsvpcConfiguration = @{ subnets = @($deployment.PrivateSubnetIds.Split(',')); securityGroups = @($deployment.ApplicationSecurityGroup); assignPublicIp = 'DISABLED' } }
}
$runInput | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath '.data/migration-task.json' -Encoding utf8NoBOM
$taskResult = aws ecs run-task --cli-input-json file://.data/migration-task.json --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $taskResult.failures.Count -gt 0 -or $taskResult.tasks.Count -eq 0) { throw 'Migration task did not start.' }
$taskArn = $taskResult.tasks[0].taskArn
aws ecs wait tasks-stopped --cluster $deployment.ClusterName --tasks $taskArn
if ($LASTEXITCODE -ne 0) { throw 'Migration wait timed out. Inspect the ECS task before continuing.' }
$finished = aws ecs describe-tasks --cluster $deployment.ClusterName --tasks $taskArn --output json | ConvertFrom-Json
if ($finished.tasks[0].containers[0].exitCode -ne 0) { throw 'Database migration failed. Check the MigrationTask CloudWatch log stream.' }
aws ecs update-service --cluster $deployment.ClusterName --service $deployment.WebServiceName --desired-count $WebCount --force-new-deployment --query 'service.serviceName' --output text
if ($LASTEXITCODE -ne 0) { throw 'Could not update the web service.' }
aws ecs update-service --cluster $deployment.ClusterName --service $deployment.WorkerServiceName --desired-count 1 --force-new-deployment --query 'service.serviceName' --output text
if ($LASTEXITCODE -ne 0) { throw 'Could not update the worker service.' }
aws ecs wait services-stable --cluster $deployment.ClusterName --services $deployment.WebServiceName $deployment.WorkerServiceName
if ($LASTEXITCODE -ne 0) { throw 'Services have not stabilized. Inspect ECS health and logs.' }
Write-Host "Deployment is healthy: $($deployment.StudioUrl)"
Write-Host "Retrieve the first-run setup token privately from Secrets Manager: $($deployment.SetupTokenSecretArn)"
Write-Host 'Use it once at /setup?token=YOUR_TOKEN. Do not commit or share the token.'
