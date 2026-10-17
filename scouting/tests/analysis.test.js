// 运行：node --test scouting/tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

for (const f of ['config', 'store', 'codec', 'analysis', 'tba']) require(path.join(__dirname, '..', 'js', f + '.js'));
const SC = globalThis.SC;
const A = SC.analysis;

function rec(over) {
  return Object.assign({ k: 'm', ev: '2026test', mt: 1, tm: 1678, st: 'R1', sc: 'a', ts: 1, te: 200, a: [], cl: {} }, over);
}

test('periodOf 按 TELEOP 时间切分时段', () => {
  assert.strictEqual(A.periodOf(100, 200), 'auto');
  assert.strictEqual(A.periodOf(250, 200), 'transition');
  assert.strictEqual(A.periodOf(350, 200), 'shift1');
  assert.strictEqual(A.periodOf(200 + 600, 200), 'shift3');
  assert.strictEqual(A.periodOf(200 + 1200, 200), 'endgame');
  assert.strictEqual(A.periodOf(200 + 1500, 200), 'endgame');
});

test('hubActive：Auto 多的联盟 Shift1/3 关闭', () => {
  assert.strictEqual(A.hubActive('shift1', true), false);
  assert.strictEqual(A.hubActive('shift2', true), true);
  assert.strictEqual(A.hubActive('shift3', false), true);
  assert.strictEqual(A.hubActive('endgame', true), true);
  assert.strictEqual(A.hubActive('shift1', null), null);
});

test('derive：估计球数、关闭时段不计分、爬塔分', () => {
  const d = A.derive(
    rec({
      hf: 'us',
      a: [
        ['z', 50, 'N', 'b'],
        ['z', 120, 'A', 't'],
        ['s', 150, 'A', 30, 5, 0],
        ['s', 200 + 150, 'A', 40, 10, 0], // shift1，本方关闭
        ['s', 200 + 400, 'A', 50, 8, 1], // shift2，激活
        ['s', 200 + 450, 'N', 20, -1, 0],
        ['d', 700],
        ['i', 800, 55],
      ],
      cl: { ao: 1, s: 200 + 1250, p: 'C', l: 2, o: 1 },
    })
  );
  assert.strictEqual(d.autoFuel, 5);
  assert.strictEqual(d.teleFuel, 8);
  assert.strictEqual(d.inactiveScoreSec, 4);
  assert.strictEqual(d.ferrySec, 2);
  assert.strictEqual(d.bump, 1);
  assert.strictEqual(d.trench, 1);
  assert.strictEqual(d.autoNeutral, true);
  assert.strictEqual(d.shootIntake, 1);
  assert.strictEqual(d.incapSec, 5.5);
  assert.strictEqual(d.climbLeft, 15);
  assert.strictEqual(d.towerPts, 15 + 20);
  assert.strictEqual(d.total, 13 + 35);
});

test('calibrate：按射球时长分 TBA 分数，Auto 用主观贡献，爬塔用 TBA', () => {
  const rows = [1, 2, 3].map((tm, i) =>
    A.derive(rec({ tm, st: 'R' + (i + 1), a: [['s', 200 + 400, 'A', [30, 10, 0][i], 99, 0]] }))
  );
  const tba = {
    qm1: {
      red: { teams: [1, 2, 3], hub: { auto: 20, shift2: 40 }, autoTower: [1, 0, 0], endTower: [0, 3, 0] },
      blue: { teams: [4, 5, 6], hub: { auto: 10 } },
    },
  };
  const subj = [{ k: 's', ev: '2026test', mt: 1, al: 'R', teams: [{ tm: 1, ac: 50 }, { tm: 2, ac: 50 }, { tm: 3, ac: 0 }] }];
  A.calibrate(rows, tba, subj);
  assert.deepStrictEqual(rows.map((d) => d.autoFuel), [10, 10, 0]);
  assert.deepStrictEqual(rows.map((d) => d.teleFuel), [30, 10, 0]);
  assert.deepStrictEqual(rows.map((d) => d.towerPts), [15, 30, 0]);
  assert.ok(rows.every((d) => d.calibrated && d.inactiveFirst === true));
});

test('calibrate：联盟没记全时保留估计值', () => {
  const rows = [A.derive(rec({ tm: 1, a: [['s', 300, 'A', 30, 7, 0]] }))];
  A.calibrate(rows, { qm1: { red: { teams: [1, 2, 3], hub: { transition: 50 } }, blue: { teams: [4, 5, 6], hub: {} } } }, []);
  assert.strictEqual(rows[0].teleFuel, 7);
  assert.strictEqual(rows[0].calibrated, false);
});

test('mergeDuplicates：两个记录员取平均', () => {
  const a = A.derive(rec({ sc: 'a', a: [['s', 300, 'A', 30, 10, 0]] }));
  const b = A.derive(rec({ sc: 'b', a: [['s', 300, 'A', 30, 20, 0]] }));
  const m = A.mergeDuplicates([a, b]);
  assert.strictEqual(m.length, 1);
  assert.strictEqual(m[0].teleFuel, 15);
  assert.strictEqual(m[0].sc, 'a/b');
});

test('teamStats + pickScores + predict', () => {
  const rows = [
    A.derive(rec({ tm: 1, mt: 1, a: [['s', 300, 'A', 30, 40, 0]], cl: { l: 3, o: 1, s: 1500 } })),
    A.derive(rec({ tm: 1, mt: 2, a: [['s', 300, 'A', 30, 20, 0]] })),
    A.derive(rec({ tm: 2, mt: 1, ns: true })),
  ];
  const stats = A.teamStats(rows, [], []);
  const t1 = stats.find((s) => s.tm === 1);
  const t2 = stats.find((s) => s.tm === 2);
  assert.strictEqual(t1.fuelPts, 30);
  assert.strictEqual(t1.towerPts, 15);
  assert.strictEqual(t1.climbRate, 0.5);
  assert.strictEqual(t2.noShow, 1);
  const ps = A.pickScores(stats, { fuel: 1, reliability: 1 });
  assert.ok(ps.find((p) => p.tm === 1).score > ps.find((p) => p.tm === 2).score);
  const by = {};
  stats.forEach((s) => (by[s.tm] = s));
  const p = A.predict(by, [1, 2, 99], [2]);
  assert.strictEqual(p.red.total, 45);
  assert.strictEqual(p.red.rows[2].s, null);
});

test('codec：编码/解码，坏行计数', () => {
  const r = rec({ nt: '中文备注, "引号"' });
  const text = 'junk\n' + SC.codec.encode(r) + '\nFRCS1{bad json';
  const out = SC.codec.decodeMany(text);
  assert.strictEqual(out.records.length, 1);
  assert.strictEqual(out.errors, 2);
  assert.deepStrictEqual(out.records[0], r);
});

test('toCsv 转义', () => {
  const d = A.derive(rec({ nt: 'a,"b"' }));
  const csv = A.toCsv([d]);
  assert.ok(csv.split('\n')[1].endsWith('"a,""b"""'));
});

test('parseScheduleCsv', () => {
  const s = SC.tba.parseScheduleCsv('match,R1,R2,R3,B1,B2,B3\n1,254,1678,971,118,148,2056\n2\t1\t2\t3\t4\t5\t6');
  assert.strictEqual(s.matches.length, 2);
  assert.strictEqual(s.matches[0].R2, 1678);
  assert.strictEqual(s.teams.length, 12);
});

test('slimTbaMatch 读取 2026 score_breakdown', () => {
  const m = {
    alliances: { red: { team_keys: ['frc1', 'frc2', 'frc3'], score: 108 }, blue: { team_keys: ['frc4', 'frc5', 'frc6'], score: 90 } },
    score_breakdown: {
      red: { hubScore: { autoPoints: 21, shift1Points: 17, endgamePoints: 31 }, autoTowerRobot1: 'Level1', autoTowerRobot2: 'None', autoTowerRobot3: 'None', endGameTowerRobot1: 'Level3', endGameTowerRobot2: 'None', endGameTowerRobot3: 'Level2', totalPoints: 108 },
      blue: { hubScore: {}, totalPoints: 90 },
    },
  };
  const s = A.slimTbaMatch(m);
  assert.deepStrictEqual(s.red.teams, [1, 2, 3]);
  assert.strictEqual(s.red.hub.auto, 21);
  assert.strictEqual(s.red.hub.shift2, 0);
  assert.deepStrictEqual(s.red.autoTower, [1, 0, 0]);
  assert.deepStrictEqual(s.red.endTower, [3, 0, 2]);
});
