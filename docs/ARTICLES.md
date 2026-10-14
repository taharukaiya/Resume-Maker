# Portfolio articles

New previews and publications use the single Shiba portfolio design. Previously published releases stay intact until an administrator republishes them. Historical design settings remain readable for existing document exports and revisions; the editor offers no alternative templates.

Administrators can enable or hide the research archive in **Publications & articles**. Hidden article sections and their attachments are excluded from new public releases. Public routes are `/article` and `/article/{id}`. Existing `/publications/{id}` links remain aliases.

Use **File library → Research article** to upload a DOC, DOCX or PDF. Word documents are malware-scanned, converted by LibreOffice in a private temporary profile with macros disabled, and scanned again. Only the resulting PDF is retained in the file library. Downloads are PDFs. Files must be at most 20 MB (5 MB in the demo); portfolios retain their existing 100 MB allowance. The VPS Docker image includes LibreOffice Writer and Liberation fonts. Local development needs LibreOffice installed; `LIBREOFFICE_BIN` can specify its executable.

With Gemini or OpenAI configured, an article upload queues extraction of title, authors, publication date, journal, volume, issue, pages, DOI, category, keywords and abstract. An existing abstract is preserved; otherwise AI proposes one. Results never overwrite the portfolio automatically. **Add article draft** copies a proposal into editable fields; admins must review, save, preview and publish. Without AI, admins can add the PDF and enter details and abstracts manually. AI processing uses the configured provider only. Free-tier quotas remain provider-controlled.

The full text extracted from the PDF is editable. Scanned documents may need manual text entry. Display text is limited to 240,000 characters, with a warning when longer; the downloadable PDF remains complete. Word conversion can change pagination or font substitution, so review the PDF.

Citation tabs include APA, IEEE, Harvard, MLA, Chicago, Vancouver, BibTeX and RIS. They use the saved publication date and DOI/canonical article address, never today's year. Missing bibliographic information is not invented. Separate authors with semicolons; names can be written `Family, Given`. Citation output is based on the supplied metadata and should be checked for publisher-specific requirements.

Run `npm run db:migrate` before starting the updated application. Migration `008_article_metadata.sql` only adds the extraction-result column. Rebuild the VPS image to install the converter, then recreate only the Brilliancy web and worker services. Do not restart or modify legacy EasyPanel services, domains, or databases.
