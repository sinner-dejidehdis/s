// Run: node --test paper-studio/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
for (const f of ['text', 'discover', 'cite', 'consistency', 'manuscript', 'language', 'paper']) require(path.join(__dirname, '..', 'js', f + '.js'));
const P = globalThis.Sigao.paper;

const MS = `Parks and heat
Abstract
We studied 120 parks in three cities. Each hectare was associated with 0.12 °C lower temperature. This proves parks always cool cities.
1. Introduction
Cities are warming (Smith, 2020). However, few studies compared vegetation types. This study aims to test whether park size predicts surface temperature.
2. Methods
We used Landsat images of 118 parks. We fitted mixed models.
Statistical analysis
Residuals were checked for normality. Results were unchanged when small parks were excluded. No data were missing.
3. Results
Each hectare was associated with 0.12 °C lower temperature (95% CI 0.08 to 0.16).
4. Discussion
Larger parks were cooler, consistent with Smith (2020) and Lee (2019). This study has limitations; future studies should add night data.
5. Conclusion
Larger parks were associated with cooler surroundings in three cities.
References
Smith, J. (2020). Urban heat. Urban Climate, 1, 1-2.
Brown, K. (2018). Trees. Forests, 2, 3-4.`;

test('splits a manuscript into paper sections, including analysis', () => {
  const s = P.fromText(MS);
  assert.match(s.abstract, /120 parks/);
  assert.match(s.analysis, /Residuals/);
  assert.match(s.conclusion, /cooler surroundings/);
  assert.match(s.references, /Brown/);
});

test('whole-paper review finds cross-section problems', () => {
  const r = P.review(P.fromText(MS), { question: 'Does park size predict temperature?' });
  const t = r.notes.map((n) => n.title).join(' | ');
  assert.match(t, /sample sizes|number/i);           // 120 vs 118
  assert.match(t, /missing from the reference list/); // Lee (2019)
  assert.match(t, /never cited/);                     // Brown (2018)
  assert.ok(r.sections.abstract.some((n) => /Absolute/.test(n.title)) || r.notes.some((n) => /Overclaiming/.test(n.title)));
});

test('each section is checked for its own job', () => {
  const n = (k, t) => P.sectionNotes(k, t, {}, {}).map((x) => x.title).join(' | ');
  assert.match(n('results', 'Students used phones more because they were stressed, which suggests a link.'), /No estimates|interpret/);
  assert.match(n('introduction', 'Phones are popular.'), /No research question|gap/);
  assert.match(n('analysis', 'We looked at the data.'), /No test or model/);
});
