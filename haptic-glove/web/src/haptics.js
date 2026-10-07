// 触觉核心（无 DOM 依赖，可在浏览器、AudioWorklet 和 Node 里复用）。
// 路线 A：每个指尖一个宽带音圈执行器，由音频声道驱动，所以这里直接合成"波形"，
// 而不是 LRA 式的 (幅度, 频率) 两个数。

export const MATERIALS = {
  // period: 纹理空间周期(mm)  rough: 0..1  hard: 0..1 (越硬碰撞越尖、频率越高)
  silk:  { period: 0.8, rough: 0.10, hard: 0.2 },
  fur:   { period: 0.6, rough: 0.35, hard: 0.1 },
  skin:  { period: 1.2, rough: 0.15, hard: 0.2 },
  wood:  { period: 2.0, rough: 0.50, hard: 0.6 },
  stone: { period: 1.5, rough: 0.80, hard: 1.0 },
  metal: { period: 3.0, rough: 0.12, hard: 1.0 },
};

// 根据网格/材质名推断触觉材质；也可在 glTF 里设 userData.haptic = "stone" 精确指定
export function materialFromName(name = "") {
  const n = name.toLowerCase();
  if (/fur|hair|wool|fuzzy/.test(n)) return "fur";
  if (/silk|satin|cloth|fabric/.test(n)) return "silk";
  if (/wood|oak|plank|timber/.test(n)) return "wood";
  if (/stone|rock|concrete|brick/.test(n)) return "stone";
  if (/metal|steel|iron|chrome|gold|alum/.test(n)) return "metal";
  return "skin";
}

// 由"指尖球与表面的几何关系"得到接触量。单位 mm、mm/s。
//   dist: 指尖球心到表面的距离(>0 在外)  radius: 指尖球半径
//   vel: 指尖速度向量  normal: 表面单位法线(指向外)
export function contactFromGeometry({ dist, radius, vel, normal }) {
  const pen = radius - dist;                       // 穿透深度
  if (pen <= 0) return { touching: false, force: 0, vtan: 0, vnorm: 0, pen: 0 };
  const vn = vel[0] * normal[0] + vel[1] * normal[1] + vel[2] * normal[2];
  const t = [vel[0] - vn * normal[0], vel[1] - vn * normal[1], vel[2] - vn * normal[2]];
  const vtan = Math.hypot(t[0], t[1], t[2]);
  // 没有力反馈，所以"力"只是一个由穿透深度推出的代理量：3mm 穿透 ≈ 满值
  return { touching: true, force: Math.min(1, pen / 3), vtan, vnorm: vn, pen };
}

// 每个手指一个声部。process(out, n) 直接写音频采样(-1..1)。
export class FingerVoice {
  constructor(sampleRate = 48000) {
    this.sr = sampleRate;
    this.p = { touching: false, force: 0, vtan: 0, material: "skin" };
    this.phase = 0;
    this.amp = 0;            // 平滑后的滑动幅度，避免咔哒声
    this.f = 0;              // 平滑后的频率
    this.impact = null;      // 碰撞瞬态 {t, amp, freq, decay}
    this.wasTouching = false;
    this.noise = 0;
  }

  // 主线程以 ~60–1000Hz 调用，传入最新接触量与进入速度
  setParams(p) {
    if (p.touching && !this.wasTouching) {
      const m = MATERIALS[p.material] || MATERIALS.skin;
      const v = Math.min(1, Math.abs(p.vnorm || 0) / 300);          // 进入速度 300mm/s 满值
      this.impact = {
        t: 0,
        amp: Math.min(1, 0.25 + 0.75 * v) * (0.4 + 0.6 * m.hard),
        freq: 120 + 180 * m.hard,                                   // 越硬频率越高
        decay: 0.012 - 0.008 * m.hard,                              // 越硬衰减越快(s)
      };
    }
    this.wasTouching = p.touching;
    this.p = p;
  }

  process(out, n) {
    const m = MATERIALS[this.p.material] || MATERIALS.skin;
    const slide = this.p.touching && this.p.vtan > 2;
    const targetF = slide ? Math.min(400, Math.max(40, this.p.vtan / m.period)) : 0;
    // 纹理幅度 ∝ 力 × 粗糙度，速度太低时淡出
    const targetA = slide ? this.p.force * (0.15 + 0.85 * m.rough) * Math.min(1, this.p.vtan / 40) : 0;
    const k = 1 - Math.exp(-1 / (0.004 * this.sr));                 // 4ms 平滑
    for (let i = 0; i < n; i++) {
      this.amp += k * (targetA - this.amp);
      this.f += k * (targetF - this.f);
      this.phase += (2 * Math.PI * this.f) / this.sr;
      if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
      let s = 0;
      if (this.amp > 1e-4) {
        // 基频 + 二次谐波，粗糙材质谐波更多，听/摸起来更"颗粒"
        s += this.amp * (Math.sin(this.phase) + m.rough * 0.5 * Math.sin(2 * this.phase));
      }
      if (this.impact) {
        const im = this.impact;
        s += im.amp * Math.exp(-im.t / im.decay) * Math.sin(2 * Math.PI * im.freq * im.t);
        im.t += 1 / this.sr;
        if (im.t > im.decay * 6) this.impact = null;
      }
      out[i] = Math.max(-1, Math.min(1, s));
    }
  }
}
