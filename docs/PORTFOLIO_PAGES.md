# Fixed reference pages

The public portfolio uses one design based on researchbyshiba.com. Home, the Research archive, the Article archive and article detail pages, About Me and Contact share Inter headings, the measured reference sizes, blue accents and white backgrounds. Article prose uses Merriweather; citations use Geist Mono. Browser titles use `|` as their separator. Authored wording is preserved.

About Me has the reference portrait frame (4:5), biography, two-column Education and Experience timelines, research-interest cards, publication table, conference section, gray awards panel and blue CV banner. Add **Interests** and **Conferences** sections through Academic sections. Existing custom sections titled Research Interests remain compatible.

In Profile, administrators can edit the About Me heading and biography independently of the home introduction, the collaboration note, contact heading and introduction, office hours, mailing address and closing quote. A separate website logo can be selected from the image library. Existing profile data remains valid without these optional fields.

The homepage uses the reference's responsive header, icon menu, compact mobile CV button, topic badge, highlighted headline, dark/light profile buttons and 4:5 portrait. Its heading is 30px/33px on phones, 36px on tablets, 48px on small desktops and 60px on large desktops. Profile provides independent homepage badge, heading and introduction fields, the blue headline phrase, and portrait crop position. Blank optional fields fall back to existing profile data until edited. Social links have freeform labels, icons, homepage visibility and ordering. Navigation settings include a separate mobile CV label and editable footer links. Website wording controls cover section headings, descriptions, table labels, form text and the CV banner. Content and section visibility remain editable within the single reference layout.

Contact uses collaboration cards and the reference profile/form/details layout. Contact entries define the cards; without a Contact section, visible research interests provide up to three default cards. A standard inquiry form is available without requiring a section. An explicitly hidden Contact section hides the page. Office hours and address fields have transparent contact prompts when no details have been supplied; no times or locations are invented. Choosing a card fills an editable subject, which is retained in the administrator's inbox with the message.

Research and Articles stay separate. Both archives use the reference search, sorting, cards and sidebar layout. Older research archives at `/article` keep working as aliases until a separate Article collection is added. About, Research and Contact addresses configured in Pages remain supported, with the default addresses kept as aliases. A custom page using a built-in address merges its visible content into that page's fixed layout.

## Refresh existing approved publications

New publication builds use this design automatically. To apply a rendering update to already-approved content while preserving unpublished editing work, use the operator script in the existing VPS worker container:

```sh
docker compose exec -T worker node --import tsx scripts/refresh-published-design.ts
docker compose exec -T worker node --import tsx scripts/refresh-published-design.ts --apply
```

The first command previews the affected published addresses. The second builds new immutable releases from the currently published snapshots, never from drafts. It retains prior releases, leaves editing revisions, status and content unchanged, and stops if another publication wins the race. Back up the application before applying it. Legacy EasyPanel applications, databases and DNS are outside this script's scope.

## Article administration

Archive display controls set page size (1–50) and default sorting. Search, category filters, topic buttons and numbered pagination work together; changing a filter returns to page one. Research and Articles remain separate collections. Archive headings, search text, dates, navigation buttons and sidebar labels are editable through Website wording.

Each article supports editable title, authors, publication date, journal, volume, issue, page range, DOI, abstract, full text, tags, cover, figure descriptions/captions/order and PDF attachment. Article display and citation controls independently show or hide the abstract, full text, figures, author panel, citations and related content. Author name, affiliation and biography may override the portfolio profile. These are presentation controls, not access restrictions on uploaded files.

Separate authors with semicolons. Choose Family, Given for names such as `van der Waals, Johannes Diderik`; ordinary legacy comma-separated names remain supported. Citations use saved publication metadata, never the current year. APA, IEEE, Harvard, MLA, Chicago, Vancouver, BibTeX and RIS have individual exact-text overrides for publisher requirements. Clear an override to resume automatic formatting. Citation styles vary by publisher; review generated citations before publishing.

PDF and Word uploads retain the existing conversion and figure-extraction workflow. AI proposes metadata and abstracts for review; it does not publish them automatically. Editing web-page text does not rewrite the attached PDF: upload a revised source document to replace the downloadable PDF.
