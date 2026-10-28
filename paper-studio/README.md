# Arguo

Prototype of an academic writing workspace for researchers writing in English. Principle: **think it through, write it yourself**. Arguo points out problems, explains how to fix them and shows examples from other topics. It never rewrites, continues or generates the user's text.

## Modules

| Module | What it does | Pain point |
|---|---|---|
| Overview | Progress per module and the next step | Progress tracking |
| Argument thread | Research question → gap → aim → method → result → conclusion; flags breaks, causal overreach and absolute wording | Sections that don't line up, can't get started |
| Discover research | Searches OpenAlex (250M+ works) by topic, date range, sort and open access; links to DOI, free full text and Google Scholar; AI briefing that may cite only the listed papers; adds papers to the matrix and reference list | Topic chosen, need the state of the art |
| Next steps & ideas | A plan from the project's state (next action first) and AI research directions grounded in the papers found | What to do next, what would be new |
| Study design | Design type and plan; rules for control, randomisation, blinding, sample size, confounders, measurement, ethics, preregistration, missing data and reporting guideline; AI design review and methods of similar studies (cited) | Designing the experiment |
| Literature matrix | Add a paper by pasting a DOI, article link (journal, arXiv, PubMed…) or title: metadata from OpenAlex, AI-drafted reading notes marked "AI draft" until edited, and a detail page per paper (abstract, links, AI analysis). One row per paper; finds recurring limitations, a dominant design and one-sided findings | A review without an argument, no clear gap |
| Citation check | Includes every matrix paper automatically; checks DOI, year, first author and title against Crossref; pick a target journal (10,000+ CSL journal styles) and DOI references are formatted in its official style by Crossref; built-in APA 7, Vancouver and Chicago otherwise | Wrong details, AI-invented references |
| Consistency check | Six tabs, one per argument-thread node (question, gap, aim, method, result, conclusion): paste that manuscript section; rules check it against the node and section conventions; each tab has a reviewer checklist, a common structure and an other-topic example; AI section review with examples drawn from published papers in Discover or the matrix (cited). The conclusion tab keeps the results-vs-discussion sentence check | Discussion that outruns the results |
| Reviewer comments | Splits comments into tasks (reviewer headings, major/minor sections, numbered points), flags must-fix and vague comments | A major revision you can't break down |
| Submission checklist | Adapts to the target journal (name, guide-for-authors link, publisher, DOAJ listing, APC from OpenAlex) and study design (reporting guideline, trial or PROSPERO registration, ethics items dropped where they do not apply); items Arguo can verify (argument thread, limitations, references verified and formatted, legitimate journal) are checked automatically | Missing items at submission |

All checks are rule-based for now (no AI backend). English is the main language; Chinese input is still recognised by the rules. Projects are stored in the browser's localStorage.

## Run

Static files, no build step:

```sh
cd paper-studio && python3 -m http.server 8000   # open http://localhost:8000
node --test paper-studio/tests/*.test.js paper-studio/tests/*.test.mjs   # from the repository root
```

## Files

- `js/text.js` term extraction (English: six-letter stems; Chinese: bigrams cut at function characters), sentence splitting, overlap scores
- `js/outline.js` `js/matrix.js` `js/consistency.js` `js/review.js` `js/cite.js` `js/checklist.js` module logic, independent of the page and tested in Node
- `js/sample.js` the example project. The Levenson, Woods & Scott, Hale & Guan and Scott et al. papers are real (checked against Crossref); Zhang & Li (2021) is made up on purpose to show an untraceable reference
- `js/app.js` rendering and interaction
- `worker/worker.js` Cloudflare Worker for AI feedback: calls Groq (`openai/gpt-oss-120b`) with the no-ghostwriting rules and drops any note that repeats 8+ words of the user's text. Needs the secret `GROQ_API_KEY`; optional `ALLOWED_ORIGINS` (comma-separated) limits which sites may call it. The page calls `https://arguo-api.arguolucid.workers.dev` unless `window.ARGUO_API` is set.
- `js/config.js` public settings: AI server URL, Supabase URL and anon key (safe to publish; never the service_role key)
- `js/cloud.js` accounts (email + password, confirmation and reset by email) and cloud projects through Supabase; the site stays local-only when Supabase is not configured
- `supabase/schema.sql` the `projects` table with row-level security, run once in the Supabase SQL editor
- `js/discover.js` OpenAlex search and parsing; falls back to the Worker's `/api/search` relay (which adds the optional `OPENALEX_API_KEY` secret) when a visitor's own OpenAlex budget is used up
- `js/ideas.js` next-step plan and the input for AI research directions
- `js/design.js` study design types, reporting guidelines and design rules
- `js/styles.js` journal style search (CSL registry via zotero.org), parent-style lookup and Crossref formatting

How the modules connect: papers found in Discover or added by link go into the literature matrix and the reference list; author-year citations typed in the argument thread or consistency check are matched against the matrix, and missing ones can be found and added; the citation check lists every matrix paper and formats the list for the chosen journal.
