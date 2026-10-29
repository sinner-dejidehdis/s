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
