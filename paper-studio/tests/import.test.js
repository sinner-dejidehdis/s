// Run: node --test paper-studio/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
for (const f of ['bib', 'manuscript', 'language']) require(path.join(__dirname, '..', 'js', f + '.js'));
const { bib: B, manuscript: M, language: L } = globalThis.Sigao;

test('BibTeX and RIS round-trip', () => {
  const p = B.parse('@article{k, title={A {Study} of Parks}, author={Doe, Jane and Roe, Rick}, journal={Urban Climate}, year={2020}, doi={10.1234/xyz}}');
  assert.strictEqual(p[0].title, 'A Study of Parks');
  assert.deepStrictEqual(p[0].authors, ['Jane Doe', 'Rick Roe']);
  const r = B.parse(B.toRis(p));
  assert.deepStrictEqual([r[0].title, r[0].authors, r[0].doi, r[0].year], ['A Study of Parks', ['Jane Doe', 'Rick Roe'], '10.1234/xyz', 2020]);
  assert.match(B.toBibtex(p), /@article\{doe2020,/);
});

test('manuscript sections map onto the consistency tabs', () => {
  const pr = M.toProject(M.split('Introduction\nCities are warming quickly and parks may help cool them down.\n\nThis study aims to test whether park size predicts temperature.\n2. Methods\nWe used satellite imagery.\nResults\nLarger parks were cooler.\nDiscussion\nSize matters.\nReferences\nSmith, J. (2020). Parks and heat. Urban Climate.'));
  assert.match(pr.check.aim, /aims to test/);
  assert.strictEqual(pr.check.method, 'We used satellite imagery.');
  assert.strictEqual(pr.refs.length, 1);
});

test('language check flags without rewriting', () => {
  const n = L.notes('Social media clearly causes insomnia. In order to test this, data were collected and were analysed.');
  const titles = n.map((x) => x.title).join(' | ');
  assert.match(titles, /Overclaiming/); assert.match(titles, /Causal/); assert.match(titles, /Wordy/); assert.match(titles, /passive/);
  assert.ok(n.every((x) => !/insomnia/.test(x.how + (x.example || ''))));
});

test('cross-check finds citations missing from the list and uncited entries', () => {
  for (const f of ['text', 'discover', 'cite', 'journals']) require(path.join(__dirname, '..', 'js', f + '.js'));
  const S = globalThis.Sigao;
  const x = S.cite.crossCheck('As Levenson et al. (2016) and Smith (2019) found.', 'Levenson, J. C. (2016). A.\nZhang, W. (2021). B.');
  assert.deepStrictEqual(x.missing.map((c) => c.author), ['Smith']);
  assert.deepStrictEqual(x.uncited.map((e) => e.author), ['zhang']);
  const n = S.cite.crossCheck('Shown [1], [2-3] and [5].', 'one entry\ntwo entry\nthree entry\nfour entry');
  assert.deepStrictEqual([n.missing.map((m) => m.text), n.uncited.map((e) => e.n)], [['[5]'], [4]]);
  const g = S.journals.group([{ sourceId: 'S1', venue: 'A', cited: 1 }, { sourceId: 'S2', venue: 'B', cited: 5 }, { sourceId: 'S2', venue: 'B', cited: 2 }, { sourceId: 'S3', venue: 'R', sourceType: 'repository', cited: 9 }]);
  assert.deepStrictEqual(g.map((j) => [j.name, j.papers.length]), [['B', 2], ['A', 1]]);
});

test('a bare DOI is not flagged for author or title', () => {
  for (const f of ['text', 'cite']) require(path.join(__dirname, '..', 'js', f + '.js'));
  const S = globalThis.Sigao;
  const e = S.cite.parse('10.1016/j.adolescence.2016.05.008')[0];
  assert.deepStrictEqual(S.cite.compare(e, { year: 2016, title: '#Sleepyteens', authors: [{ family: 'Woods' }] }), []);
});
