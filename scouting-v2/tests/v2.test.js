// Run: node --test scouting-v2/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
for (const f of ['config', 'codec', 'stats']) require(path.join(__dirname, '..', 'js', f + '.js'));
const V2 = globalThis.V2;

function match(over) {
  return Object.assign({ s: 'AB', e: '2026test', l: 'qm', m: 3, r: 'r2', t: 1678, sp: [[10, 40]], pl: true, ns: false,
    af: 8, am: 2, an: true, ai: ['d'], as: [[30, 20], [35, 50]], ac: 'y',
    tf: 40, tm: 10, tp: 12, gf: 6, gm: 1, ts: [[20, 30]], tx: ['b', 't'], tq: 'f', tc: ['g'], ti: 0, td: 4.25,
    el: 'L3', ep: 'C', ef: false, et: 6.5, ds: 4, dr: 'n', dd: 3, sa: 'h', to: false, dk: false, bf: false, cd: 'n', co: 'fast\tcycler\nnice' }, over);
}

test('encode/decode round trip, tabs and newlines in text are flattened', () => {
  const row = V2.codec.encode('match', match());
  assert.ok(row.startsWith('RB26M2\t'));
  assert.strictEqual(row.split('\n').length, 1);
  const d = V2.codec.decode(row);
  assert.strictEqual(d.kind, 'match');
  assert.strictEqual(d.values.t, 1678);
  assert.deepStrictEqual(d.values.as, [[30, 20], [35, 50]]);
  assert.deepStrictEqual(d.values.tx, ['b', 't']);
  assert.strictEqual(d.values.td, 4.3);
  assert.strictEqual(d.values.dr, 'n');
  assert.strictEqual(d.values.dd, 3);
  assert.strictEqual(d.values.gf, 6);
  assert.strictEqual(d.values.e, V2.CONFIG.event);
  assert.strictEqual(d.values.co, 'fast cycler nice');
  assert.strictEqual(d.values.pl, true);
});

test('header has one column per value', () => {
  assert.strictEqual(V2.codec.header('match').split('\t').length, V2.codec.encode('match', match()).split('\t').length);
  assert.strictEqual(V2.codec.header('pit').split('\t').length, V2.codec.encode('pit', { t: 1 }).split('\t').length);
});

test('decode rejects foreign or truncated rows', () => {
  assert.strictEqual(V2.codec.decode('hello\tworld'), null);
  assert.strictEqual(V2.codec.decode('RB26M2\t1\t2'), null);
  // a row from the previous build (old tag) is rejected
  assert.strictEqual(V2.codec.decode('RB26M' + V2.codec.encode('match', match()).slice(6)), null);
});

test('rowPoints and team stats', () => {
  assert.strictEqual(V2.stats.rowPoints(match()), 8 + 40 + 6 + 15 + 30);
  assert.strictEqual(V2.stats.rowPoints(match({ ns: true })), 0);
  const s = V2.stats.teams([match(), match({ m: 4, tf: 20, af: 2, am: 0, tm: 0, gf: 0, gm: 0, el: 'None', ac: 'n', dr: 4, dd: 'n' }), match({ m: 5, ns: true })])[0];
  assert.strictEqual(s.n, 3);
  assert.strictEqual(s.noShow, 1);
  assert.strictEqual(s.teleFuel, 30);
  assert.strictEqual(s.points, (99 + 22) / 2);
  assert.strictEqual(s.accuracy, Math.round((76 / 89) * 100));
  assert.strictEqual(s.endFuel, 3);
  assert.strictEqual(s.defRating, 4);
  assert.strictEqual(s.playedDefense, 1);
  assert.strictEqual(s.wasDefended, 1);
  assert.deepStrictEqual(s.levels, { None: 1, L1: 0, L2: 0, L3: 1 });
  assert.strictEqual(s.autoL1, 50);
});

test('offline file is built from the current sources', () => {
  const fs = require('node:fs');
  const { build } = require(path.join(__dirname, '..', 'tools', 'build-offline.js'));
  const committed = fs.readFileSync(path.join(__dirname, '..', 'rebuilt-scout-v2-offline.html'), 'utf8');
  assert.strictEqual(committed, build(), 'run: node scouting-v2/tools/build-offline.js');
  assert.ok(!/<script src=|<link rel="stylesheet"/.test(committed), 'offline file must not load external files');
});
