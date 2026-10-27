# Arguo

Prototype of an academic writing workspace for researchers writing in English. Principle: **think it through, write it yourself**. Arguo points out problems, explains how to fix them and shows examples from other topics. It never rewrites, continues or generates the user's text.

## Modules

| Module | What it does | Pain point |
|---|---|---|
| Overview | Progress per module and the next step | Progress tracking |
| Argument thread | Research question → gap → aim → method → result → conclusion; flags breaks, causal overreach and absolute wording | Sections that don't line up, can't get started |
| Literature matrix | One row per paper; finds recurring limitations, a dominant design and one-sided findings | A review without an argument, no clear gap |
| Citation check | Checks DOI, year, first author and title against Crossref; formats APA 7, Vancouver or Chicago author-date | Wrong details, AI-invented references |
| Consistency check | Discussion sentences without a supporting result, causal claims from correlational data, missing limitations | Discussion that outruns the results |
| Reviewer comments | Splits comments into tasks (reviewer headings, major/minor sections, numbered points), flags must-fix and vague comments | A major revision you can't break down |
| Submission checklist | 23 items on journal fit, manuscript, statements and ethics, files | Missing items at submission |

All checks are rule-based for now (no AI backend). English is the main language; Chinese input is still recognised by the rules. Projects are stored in the browser's localStorage.

## Run

Static files, no build step:

```sh
cd paper-studio && python3 -m http.server 8000   # open http://localhost:8000
node --test paper-studio/tests/*.test.js          # run from the repository root
```

## Files

- `js/text.js` term extraction (English: six-letter stems; Chinese: bigrams cut at function characters), sentence splitting, overlap scores
- `js/outline.js` `js/matrix.js` `js/consistency.js` `js/review.js` `js/cite.js` `js/checklist.js` module logic, independent of the page and tested in Node
- `js/sample.js` the example project. The Levenson, Woods & Scott, Hale & Guan and Scott et al. papers are real (checked against Crossref); Zhang & Li (2021) is made up on purpose to show an untraceable reference
- `js/app.js` rendering and interaction
