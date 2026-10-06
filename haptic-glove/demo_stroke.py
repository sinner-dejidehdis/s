"""模拟食指指腹被毛皮从指尖向指根抚过，打印每帧 3x4 阵列的幅度热图。"""
from glove.layout import build_layout, zone_tactors
from glove.render import Renderer, Contact

layout = build_layout()
r = Renderer(layout)
tacs = zone_tactors(layout, "index")
y, v, dt = -2.0, 40.0, 0.02          # 起点 mm，速度 mm/s，帧间隔 20ms
shades = " .:-=+*#%@"
for frame in range(0, 30):
    st = r.step([Contact("index", 0.0, y, force=0.6, vy=v, material="fur")])
    if frame % 3: 
        y += v * dt
        continue
    print(f"t={frame*dt*1000:4.0f}ms y={y:5.1f}mm")
    for row in range(3, -1, -1):
        line = ""
        for t in tacs:
            if t.row == row:
                a = st[t.idx].amp
                line += shades[min(9, int(a * 10))] * 2 + " "
        print("   ", line)
    y += v * dt
