param([Parameter(Mandatory=$true)][string]$Hostname,[Parameter(Mandatory=$true)][string]$CertificateArn,[switch]$Activate)
$ErrorActionPreference='Stop'
$deployment=(Get-Content -LiteralPath '.data/aws-outputs.json' -Raw | ConvertFrom-Json).BrilliancyResearch
$command=@('node','--import','tsx','scripts/domain-provision.ts',$Hostname,$CertificateArn)
if($Activate){$command+= 'activate'}
$inputObject=@{cluster=$deployment.ClusterName;taskDefinition=$deployment.DomainOperatorTaskArn;launchType='FARGATE';networkConfiguration=@{awsvpcConfiguration=@{subnets=@($deployment.PrivateSubnetIds.Split(','));securityGroups=@($deployment.ApplicationSecurityGroup);assignPublicIp='DISABLED'}};overrides=@{containerOverrides=@(@{name='Application';command=$command})}}
$inputObject | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath '.data/domain-task.json' -Encoding utf8NoBOM
$result=aws ecs run-task --cli-input-json file://.data/domain-task.json --output json | ConvertFrom-Json
if($LASTEXITCODE -ne 0 -or $result.failures.Count -gt 0 -or $result.tasks.Count -eq 0){throw 'Domain task did not start.'}
$taskArn=$result.tasks[0].taskArn
aws ecs wait tasks-stopped --cluster $deployment.ClusterName --tasks $taskArn
if($LASTEXITCODE -ne 0){throw 'Domain task wait timed out. Check ECS.'}
$task=aws ecs describe-tasks --cluster $deployment.ClusterName --tasks $taskArn --output json | ConvertFrom-Json
if($task.tasks[0].containers[0].exitCode -ne 0){throw 'Domain operation failed. Read the DomainOperator CloudWatch log stream.'}
Write-Host 'Domain operation completed. Read the DomainOperator CloudWatch stream for the DNS target and next step.'
