---
name: onshape-modeler
description: Build parametric CAD models directly in the user's Onshape Part Studio from a plain-language request (e.g. "我想要一个这样的 intake", "make me a 2-roller intake 24in wide"), starting from sketches then extrudes, via the Onshape REST API. Use for FRC robot mechanisms and simple parts whenever the user wants something modeled in Onshape. Also use to modify a model this skill built earlier ("宽一点", "加一个滚轮").
---

# Onshape Modeler

把一句设计意图变成 Onshape 里真实的特征树：先建 Sketch，再 Extrude。用户是 FRC 队员，默认用英制和 FRC 常见件。

## 运行前提（第一次用时检查）

1. 必须在用户本机运行（Claude Code / 桌面版连接本地），云端沙盒访问不到 cad.onshape.com。
2. `pip install requests`
3. 密钥：`ONSHAPE_ACCESS_KEY` / `ONSHAPE_SECRET_KEY` 放在环境变量，或本 skill 目录下的 `.env`（参考 `.env.example`）。在 https://dev-portal.onshape.com → API keys 生成，权限勾选 Read + Write。**绝不要让用户把密钥贴进对话**；缺密钥时告诉他们放到 `.env` 里。
4. 需要 Part Studio 的 URL：`https://cad.onshape.com/documents/<did>/w/<wid>/e/<eid>`。没给就问一次。建议用户新建一个空的 Part Studio 给 AI 用。

## 工作流程

### 1. 理解需求，自己定参数
- 判断机构类型。已有模板见下表；没有模板就按“自定义零件”写计划。
- 用户没说的参数**不要追问**，直接用 FRC 常见默认值（见 `references/frc_defaults.md`），开始建模前用 3-5 行说明关键尺寸和假设，让用户知道之后可以改。
- 如果用户给了参考图，从图里估计滚轮数量、相对位置、入口高度等，写进参数。

| 需求 | 模板 |
|---|---|
| intake / 滚轮吸入 / roller intake | `scripts/templates/roller_intake.py` |
| elevator / 升降 / 电梯（2 级 continuous，皮带走管内） | `scripts/templates/elevator.py` |

### 2. 生成建模计划（plan.json）
- 有模板：`python scripts/templates/roller_intake.py --set inner_width=24 --set rollers='[[11,2],[5.5,4.5],[1,6]]' > plan.json`
- 自定义零件：按 `references/plan_format.md` 手写 plan.json。
- 先跑 `python scripts/build.py plan.json --dry-run` 确认能生成。

### 3. 在 Onshape 里建模
```
python scripts/build.py plan.json --url "<Part Studio URL>" --replace
```
- `--replace` 会先删除上一次同 tag 的特征再重建，修改参数后重跑就是“改模型”。
- 新机构不要建在已有机构的 Part Studio 里：加 `--new-studio <名字>`，脚本会在同一文档里新建一个 Part Studio 再建，并打印它的链接。
- 建完后脚本会把每个零件改名为对应拉伸特征的名字（如 `S1 tube L`）。
- 第一次连接先跑 `python scripts/build.py --url "<URL>" --check` 验证密钥和链接。
- 脚本逐个特征提交并打印状态；遇到非 OK 会停下。按提示排查：
  - 草图不闭合 / 线段自交 → 检查点序、减重孔是否碰到外轮廓
  - 拉伸方向反了 → 改 `direction`（normal / flip / symmetric）
  - 平面找不到 → `plane` 必须是 Top/Front/Right 或前面 `plane` 步骤的 id

### 4. 校验并汇报
脚本最后会列出零件数和整体包围盒。对照需求核对（比如宽度 ≈ inner_width + 2×板厚 + 2×轴伸出）。给用户简短结论：建了哪些零件、关键尺寸、用了哪些假设，并提示可以直接说“宽 2 寸”“换 3 个滚轮”来修改。

## 建模规则（自定义 plan 必读，详见 references/plan_format.md）
- 一个草图 = 一次拉伸，草图里所有闭合轮廓都会被拉伸。**孔不要和外轮廓画在同一个草图里**（会被当成实心填上）：先拉外形，再在同平面单独画孔草图，用 `"op": "remove"` 切除。
- 新零件用 `op: new`，要并入已有零件用 `add`。

## 已知限制与 API 要点
roller intake（30 个特征）和 elevator（48 个特征）两个模板都已在真实 Onshape（v6 API）上建成并全部 OK，elevator 在收起和全伸出两种姿态下都做过干涉检查，特征 JSON 的写法已经按真实报错修正过。以后改 `scripts/features.py` 时注意这几点：
- 草图直线的 geometry 字段是 `pntX/pntY/dirX/dirY`。写成 `pointVector/direction` 会被静默忽略，草图显示 OK，但里面没有区域，后面的拉伸会报 ERROR。
- 平面的 `offset` 不接受负值：取绝对值，再用 `oppositeDirection` 表示方向。
- extrude 的 `defaultScope` 默认是 false，add/remove 必须设成 true，否则找不到要合并或切除的零件。对称拉伸用布尔参数 `symmetric`，不要用 `endBound`。
- 遇到 "does not match its feature spec" 时，用 `GET .../featurespecs` 查参数定义；遇到 ERROR 时，用 `POST .../featurescript` 执行 `evaluateQuery` 数一下 query 命中了几个实体。

## Elevator 模板说明
蓝本是 254 2025 Undertow 的 elevator（技术手册第 16 页）：2 级、continuous 连续绳法，所有级都用 2x1x1/16" 方管加轴承块，9mm 宽 HTD5 皮带走管内，由 2 个 Kraken X60 经 11:50 齿轮驱动 36T 皮带轮当卷筒，行程约 52"，约 0.3s 走完。254 在 2023 手册里写过，elevator 刚度不足是限制他们对位速度的主要因素。模板在这个基础上做了下面的改进：
- 固定级管壁用 1/8"，运动级保持 1/16"：固定级更刚，同时不增加运动质量。
- 每一级都做成闭合框（底横梁 + 顶横梁）。stage 1 的横梁始终在 stage 0 横梁的上方，两者永远不会相遇，所以横梁可以都放在背面，前面只留给 carriage。
- 满伸出时两级之间至少重叠 `min_overlap`（默认 8"）。行程由脚本从 `base_height` 反算，超出最大行程会直接报错，不会建出一个伸出后散架的模型。
- 每一级向前错开 1/8"，运动的管子不会贴着上一级的横梁滑。
- 背面加 A 字斜撑，并留出卷筒轴和两侧轴承板的位置。

常用参数：`travel`、`base_height`、`width`、`carriage_length`、`extension`（0=收起，1=全伸出，用来检查伸出后的姿态）。plan 里的 `info` 会给出各级行程和满伸出时的重叠量。轴承块、皮带、电机没有建模（放轴承块的间隙是 `bearing_gap`）；A 字斜撑按实心 1x1 简化。

## 修改已建模型
保留上次的 plan.json（或重新用模板+新参数生成），改参数后 `--replace` 重建。不要在用户手动改过的特征上直接覆盖：如果特征树里有非本 skill 前缀的特征依赖这些零件，先提醒用户。

## 坐标约定
世界 X = 左右（机构宽度），Y = 前后，Z = 上下。侧板画在平行于 Right 平面的偏移平面上，草图 x = 前后，y = 上下，枢轴在原点。

## 扩展新模板
新机构（shooter、elevator 滑块、爪子等）照 `roller_intake.py` 写一个生成 plan 的脚本，放进 `scripts/templates/` 并加到上表。
