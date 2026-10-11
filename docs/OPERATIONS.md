# Operations and launch verification

## Required live checks

- Confirm HTTPS and certificate renewal for the studio and one researcher domain.
- Create a real administrator and enroll MFA. Create a client account and verify both permitted edits and denied requests.
- Verify SES identity, production approval, invitation delivery, and password recovery. Confirm mail does not land in spam.
- Evaluate AI summaries against complete source papers, including numerical results and limitations. Test a scanned PDF using the selected model's PDF support. Reject unsupported claims before publication.
- Upload allowed media, reject an executable renamed as a PDF, and verify ClamAV is healthy. Use the harmless EICAR test file only in a controlled security test.
- Confirm public HTML contains substantive content, canonical metadata, structured data, and sitemap entries without client JavaScript.
- Test contact forms, draft preview, stale-save conflict, publication failure, rollback, and unpublish behavior.
- Verify private source storage cannot be read through public S3 or CDN URLs. The public asset distribution must reject HTML and all non-asset paths.
- Run dependency audit and arrange an independent review before accepting a production security commitment.

## Monitoring

Configure external uptime checks for the studio and at least one public portfolio. Alert the responsible operator on sustained failure. Monitor ALB error rate/latency, ECS restarts, RDS CPU/connections/storage, failed jobs, WAF blocks, ClamAV health, and SES bounces/complaints. CDK creates logs and metrics; configure alert destinations using the agency's real incident contact.

The status endpoint proves application/database responsiveness. It does not prove SES delivery, model correctness, malware definition freshness, or every tenant's custom domain.

## Backup and recovery

RDS has 14 days of automated backup retention and deletion protection. S3 has versioning and retention on stack removal. These do not replace a restore drill.

Restore RDS to a separate private instance, verify users/sites/revisions, and test the application against the restored database in a staging environment. Recover a deleted private media object from S3 version history. Repoint staging release manifests and confirm a published page. Record actual recovery time and data loss window before committing to an RTO/RPO.

Protect and retain the session encryption secret. Losing it prevents decryption of enrolled authenticator seeds. Rotate with a planned re-enrollment or key-version migration; do not replace it casually. Password reset does not disable MFA. If the only administrator loses MFA and its saved setup key, recovery is an operator procedure requiring verified agency ownership and a documented database change.

Cross-region recovery and account-level outage recovery require additional replication, permissions, and a tested runbook. The supplied baseline is Multi-AZ, not active-active multi-region.

## Publishing incidents

Failed jobs show their error in the editor. The worker retries up to three times, retaining the previous live release. Investigate the error before submitting another publish. A CloudFront deployment propagates asynchronously; publishing completion means the update was accepted, not that every edge has switched instantly.

If a release is wrong, use Restore release. This changes public content without replacing the current draft. If the draft is wrong, use History → Restore draft, then review and publish.

If unpublishing, allow CDN caches and disabled distributions to propagate. Previously published download assets use immutable URLs and remain in retained release storage. For a complete removal request, identify all affected release keys, remove their public copies, and invalidate the asset CDN as well as domain distributions. Previously downloaded copies cannot be recalled.

## Maintenance

Administrators can delete never-published drafts in Review & publish using typed
slug confirmation. A database transaction removes the site and dependent content,
retains audit events, and queues private/failed-release file prefixes in
`storage_cleanup`. The worker processes cleanup when no publication/AI job is
ready; failures retry after one minute. Monitor oldest queued cleanup and rows
with nonzero attempts. S3 version history and database backups are retained under
the agency's retention policy; deletion from the workspace is not backup erasure.

Keep Next.js, Node.js, PDF/image parsing libraries, ClamAV, and AWS dependencies updated. Pin and test release images in staging. Inspect job backlogs and database growth. Rate-limit/session/token rows and historical releases require an explicit retention policy; do not delete audit history or published artifacts without an agreed policy and backup.

Use different AWS accounts or isolated resources for staging and production. Never copy production secrets into tests. Test fixtures live only in `.test-data`.

## Known verification boundaries

Local automated tests verify application workflows and synthesize/assert the infrastructure definition. Real AWS deployment, Docker image execution, SES production approval, CloudFront DNS/TLS, real model output, and a production restore drill require the agency's accounts and must be completed before launch.
