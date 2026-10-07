// 触觉输出通道。默认走音频：每个手指一个声道 -> USB 多声道声卡 -> 功放 -> 音圈执行器。
import { FingerVoice } from "./haptics.js";

// 把 FingerVoice 的源码塞进 AudioWorklet（不重复实现一份 DSP）
async function workletUrl() {
  const src = await (await fetch(new URL("./haptics.js", import.meta.url))).text();
  const body = src.replace(/^export\s+/gm, "");
  const code = `${body}
class HapticProc extends AudioWorkletProcessor {
  constructor(o){ super(); this.voices=[]; const n=o.processorOptions.fingers;
    for(let i=0;i<n;i++) this.voices.push(new FingerVoice(sampleRate));
    this.port.onmessage=(e)=>{ const {finger,params}=e.data; if(this.voices[finger]) this.voices[finger].setParams(params); }; }
  process(_, outputs){ const out=outputs[0];
    for(let i=0;i<this.voices.length && i<out.length;i++) this.voices[i].process(out[i], out[i].length);
    return true; } }
registerProcessor("haptic-proc", HapticProc);`;
  return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
}

export class AudioLink {
  constructor(fingers = 2) { this.fingers = fingers; }
  async start() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    await this.ctx.audioWorklet.addModule(await workletUrl());
    const maxCh = this.ctx.destination.maxChannelCount || 2;
    const ch = Math.max(this.fingers, 2);
    this.ctx.destination.channelCount = Math.min(ch, maxCh);
    this.ctx.destination.channelInterpretation = "discrete";
    this.node = new AudioWorkletNode(this.ctx, "haptic-proc", {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [this.fingers],
      processorOptions: { fingers: this.fingers },
    });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.node.connect(this.ctx.destination);
    this.node.connect(this.analyser);
    return { channels: this.ctx.destination.channelCount, maxCh, latency: (this.ctx.baseLatency + (this.ctx.outputLatency || 0)) * 1000 };
  }
  send(finger, params) { if (this.node) this.node.port.postMessage({ finger, params }); }
}

// 备用：把接触量以 JSON 发给本机桥接程序/固件（ESP32 走 WebSocket），自己合成波形
export class WebSocketLink {
  constructor(url) { this.ws = new WebSocket(url); }
  send(finger, params) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify({ finger, ...params })); }
}
