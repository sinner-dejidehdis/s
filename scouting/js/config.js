// 赛季配置：换赛季时主要改这个文件。
// 2026 REBUILT 数值来自官方手册 Table 6-2 / 6-4（经 frcmanual.com 核对）。
var SC = (globalThis.SC = globalThis.SC || {});

SC.GAME = {
  id: 'rebuilt2026',
  name: '2026 REBUILT',
  season: 2026,

  // 时间（秒）
  autoSec: 20,
  teleopSec: 140,
  // TELEOP 内的时段，start/end 相对 TELEOP 开始
  // alt: 交替时段（Shift1/3 由 Auto 进球多的联盟关闭，Shift2/4 反过来）
  periods: [
    { key: 'transition', label: 'Transition', start: 0, end: 10, alt: null },
    { key: 'shift1', label: 'Shift 1', start: 10, end: 35, alt: 'first' },
    { key: 'shift2', label: 'Shift 2', start: 35, end: 60, alt: 'second' },
    { key: 'shift3', label: 'Shift 3', start: 60, end: 85, alt: 'first' },
    { key: 'shift4', label: 'Shift 4', start: 85, end: 110, alt: 'second' },
    { key: 'endgame', label: 'End Game', start: 110, end: 140, alt: null },
  ],

  points: {
    fuelActive: 1, // 激活 Hub 每个 Fuel
    autoTowerL1: 15, // AUTO 只能 L1，每联盟最多 2 台
    tower: { 0: 0, 1: 10, 2: 20, 3: 30 },
  },
  // 地区赛 / 区域赛门槛
  rp: { energized: 100, supercharged: 360, traversal: 50 },

  startPositions: ['Left', 'Left-center', 'Center', 'Right-center', 'Right'],
  climbPositions: ['A', 'B', 'C', 'D', 'E'],

  zones: {
    A: { label: 'Our zone', shoot: 'Score' },
    N: { label: 'Neutral', shoot: 'Ferry' },
    O: { label: 'Opp. zone', shoot: 'Poach' },
  },
  zoneOrder: ['A', 'N', 'O'],

  // 松开射球键后弹出的"大约进了几个"快捷选项
  fuelEstimateChips: [0, 3, 5, 8, 10, 15, 20, 30],

  // 客观记录员赛后勾选
  postTags: [
    { key: 'tip', label: 'Tipped over' },
    { key: 'beach', label: 'Beached on Fuel' },
    { key: 'broke', label: 'Mechanism broke' },
    { key: 'disc', label: 'Disconnected / dead' },
    { key: 'foul', label: 'Many fouls' },
    { key: 'shuttle', label: 'Mostly ferried' },
    { key: 'hp', label: 'Relied on human player' },
  ],

  // 主观记录员 / 策略员的标签（参考 1678 Stand Strategist "Tags"）
  // kind: bool 或 level（1-4，红→黄→绿→紫）
  subjectiveTags: [
    { cat: 'Auto/Endgame', key: 'autoCenter', label: 'Auto went to neutral', kind: 'bool' },
    { cat: 'Auto/Endgame', key: 'autoReliable', label: 'Auto reliability', kind: 'level' },
    { cat: 'Auto/Endgame', key: 'climbFast', label: 'Climb speed', kind: 'level' },
    { cat: 'Driving', key: 'agility', label: 'Agility', kind: 'level' },
    { cat: 'Driving', key: 'awareness', label: 'Field awareness', kind: 'level' },
    { cat: 'Driving', key: 'pushback', label: 'Handles defense', kind: 'level' },
    { cat: 'Active Shift', key: 'cycleScore', label: 'Cycles to score', kind: 'bool' },
    { cat: 'Active Shift', key: 'stationary', label: 'Shoots from one spot', kind: 'bool' },
    { cat: 'Inactive Shift', key: 'collect', label: 'Collects / stockpiles', kind: 'bool' },
    { cat: 'Inactive Shift', key: 'ferry', label: 'Ferries', kind: 'bool' },
    { cat: 'Inactive Shift', key: 'idle', label: 'Idle', kind: 'bool' },
    { cat: 'Defense', key: 'defense', label: 'Defense quality', kind: 'level' },
    { cat: 'Defense', key: 'defPin', label: 'Pins / blocks', kind: 'bool' },
    { cat: 'Broken', key: 'brokeIntake', label: 'Intake broke', kind: 'bool' },
    { cat: 'Broken', key: 'brokeShooter', label: 'Shooter broke', kind: 'bool' },
    { cat: 'Broken', key: 'brokeDrive', label: 'Drive / power lost', kind: 'bool' },
  ],

  // Pit 记录字段
  pitFields: [
    { key: 'weight', label: 'Robot weight (lb)', type: 'number' },
    { key: 'drive', label: 'Drivetrain', type: 'select', options: ['Swerve', 'Tank', 'Mecanum', 'Other'] },
    { key: 'cross', label: 'Can cross', type: 'multi', options: ['Bump', 'Trench'] },
    { key: 'shooter', label: 'Shooter type', type: 'select', options: ['Turret', 'Fixed + adjustable hood', 'Fixed', 'None'] },
    { key: 'hopper', label: 'Hopper capacity (Fuel)', type: 'number' },
    { key: 'intake', label: 'Intake', type: 'select', options: ['Ground, full width', 'Ground, narrow', 'Outpost only', 'None'] },
    { key: 'bps', label: 'Claimed shot rate (Fuel/s)', type: 'number' },
    { key: 'fullField', label: 'Long-range / full-field shots', type: 'bool' },
    { key: 'climb', label: 'Climb levels', type: 'multi', options: ['L1', 'L2', 'L3'] },
    { key: 'autoClimb', label: 'Auto L1 climb', type: 'bool' },
    { key: 'autos', label: 'Auto paths / start spots', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],

  // The Blue Alliance 2026 score_breakdown 读取方式
  tba: {
    // hubScore 下每段的分数键（激活 Hub 每球 1 分，所以分数≈进球数）
    hubPeriods: {
      auto: 'autoPoints',
      transition: 'transitionPoints',
      shift1: 'shift1Points',
      shift2: 'shift2Points',
      shift3: 'shift3Points',
      shift4: 'shift4Points',
      endgame: 'endgamePoints',
    },
    towerLevel: { None: 0, Level1: 1, Level2: 2, Level3: 3 },
  },

  // 选人权重预设（参考 1678 pickability：只看对我们有用的能力）
  pickPresets: {
    '1st pick': { fuel: 1.0, tower: 0.5, auto: 0.4, reliability: 0.6, defense: 0, driving: 0.3 },
    '2nd pick': { fuel: 0.6, tower: 0.6, auto: 0.3, reliability: 1.0, defense: 0.3, driving: 0.4 },
    'Defensive 2nd': { fuel: 0.1, tower: 0.4, auto: 0.1, reliability: 1.0, defense: 1.0, driving: 0.8 },
  },
};
