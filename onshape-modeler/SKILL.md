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

### 2. 生成建模计划（plan.json）
- 有模板：`python scripts/templates/roller_intake.py --set inner_width=24 --set rollers='[[11,2],[5.5,4.5],[1,6]]' > plan.json`
- 自定义零件：按 `references/plan_format.md` 手写 plan.json。
- 先跑 `python scripts/build.py plan.json --dry-run` 确认能生成。

### 3. 在 Onshape 里建模
```
python scripts/build.py plan.json --url "<Part Studio URL>" --replace
```
- `--replace` 会先删除上一次同 tag 的特征再重建，修改参数后重跑就是“改模型”。
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

## 已知限制
特征 JSON（btType 版本、平面/草图区域的 query 写法）是按 Onshape REST 文档写的，已用本地 mock 验证流程，**但未在真实 Onshape 上验证过**。第一次真实运行若某个特征报错，把脚本打印的错误贴出来，优先检查 `scripts/features.py` 里的 `_q()` / `plane_query()`。

## 修改已建模型
保留上次的 plan.json（或重新用模板+新参数生成），改参数后 `--replace` 重建。不要在用户手动改过的特征上直接覆盖：如果特征树里有非本 skill 前缀的特征依赖这些零件，先提醒用户。

## 坐标约定
世界 X = 左右（机构宽度），Y = 前后，Z = 上下。侧板画在平行于 Right 平面的偏移平面上，草图 x = 前后，y = 上下，枢轴在原点。

## 扩展新模板
新机构（shooter、elevator 滑块、爪子等）照 `roller_intake.py` 写一个生成 plan 的脚本，放进 `scripts/templates/` 并加到上表。
