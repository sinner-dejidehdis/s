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
| elevator / 升降 / 电梯（2 级 continuous，WCP-0199 轴承块，带装配体和 BOM） | `scripts/templates/elevator.py` |

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
roller intake（30 个特征）和 elevator（137 个特征 + 174 个实例的装配体）都已在真实 Onshape（v6 API）上建成并全部 OK，elevator 的自制件之间做过干涉检查，特征 JSON 的写法已经按真实报错修正过。以后改 `scripts/features.py` 时注意这几点：
- 草图直线的 geometry 字段是 `pntX/pntY/dirX/dirY`。写成 `pointVector/direction` 会被静默忽略，草图显示 OK，但里面没有区域，后面的拉伸会报 ERROR。
- 平面的 `offset` 不接受负值：取绝对值，再用 `oppositeDirection` 表示方向。
- extrude 的 `defaultScope` 默认是 false，add/remove 必须设成 true，否则找不到要合并或切除的零件。对称拉伸用布尔参数 `symmetric`，不要用 `endBound`。
- 遇到 "does not match its feature spec" 时，用 `GET .../featurespecs` 查参数定义；遇到 ERROR 时，用 `POST .../featurescript` 执行 `evaluateQuery` 数一下 query 命中了几个实体。

## Elevator 模板说明（可建造版：Part Studio + Assembly）
`scripts/templates/elevator.py` 生成的 plan 同时包含 Part Studio 的特征，以及 `assembly` 段（标准件清单、刚性组、slider）。`build.py` 建完零件后会接着建（或清空重建）名为 **Elevator Assembly** 的装配体，并导出 `bom_elevator.csv`。只想建零件时加 `--no-assembly`。

- **蓝本**：254 2025 Undertow 的 elevator（技术手册第 16 页）：2 级、continuous，所有级都用 2x1x1/16" 管加轴承块，2 个 Kraken X60，行程约 52"。254 在 2023 年说过刚度不足是限制他们对位速度的主要原因。
- **导向**：8 个 WCP-0199 inline 轴承块（3/4" 轴承配置，级间隙 1/4"），分别在 S0 顶、S1 底、carriage 底和顶。块的套筒插进管端，用 3 颗 10-32 螺栓穿管固定；S1 底和 carriage 的这 3 颗螺栓同时夹住角撑板或前板。WCP-0199 只配 1/16" 壁厚的管，所以固定级不再用 1/8" 壁厚。
- **结构（刚度改进）**：每一级都是闭合框。外级的顶横梁放在背面，通过侧角撑板（3/16" 铆钉）和管堵（ELV-040，等同 WCP-0374）连接，让内级可以穿过；底横梁在同一平面内，用前后两块 1/8" 角撑板加 2.5" 螺栓夹紧。满伸出时 S0 和 S1 至少重叠 `min_overlap`，超出最大行程会直接报错。
- **驱动**：2 个 Kraken X60 装在两侧 1/4" 电机板内侧，12T→36T（HTD5 9mm，60T 皮带，3:1）带动 1/2" hex 卷筒轴，轴上两个 24T 卷筒。空载线速度约 157 in/s，和 254 相当。
- **没做的**：连续绳法的提升皮带、惰轮和皮带夹没有建模，这是下一步；轴套和卡簧、线缆、拖链也没有；S0 需要用户在装配体里右键 Fix，或者装到底盘上。

标准件来自 MKCad 公开库，记录在 `references/cots.json`（文档、版本、零件 id，以及零件自身坐标系）。新增标准件时，先用 bodydetails 查清它的坐标系再写进去。

## 装配体 API 要点（踩过的坑）
- 插入：`POST /assemblies/.../instances`，外部零件要带 `versionId` 和 `partId`；插入整个子装配用 `isAssembly: true`。只给 `isWholePartStudio` 时，外部文档的零件会被静默跳过。
- 定位：`POST .../occurrencetransforms` 要用 **isRelative: true**（新实例在原点，相对等于绝对）。对子装配用绝对变换会把内部零件打乱。
- 同一厂商的螺栓，不同长度的自身坐标系可能不同（MKCad 的 0.5"/2.25" 沿 Y，1.5"/2.5" 沿 X 且居中），必须逐个确认。
- 装配体里的 mate connector 用 `BTMInferenceQueryWithOccurrence-1083`，里面必须是 **`deterministicIds`（列表）**。写成单数 `deterministicId` 会一直 ERROR，也没有报错信息。面 id 从 Part Studio 的 `bodydetails` 取。
- slider 要求两个连接器的 z 轴共线；用连接器的 `transform/translationX/Y` 把其中一个平移到另一个的轴线上。刚性组用 `BTMMateGroup-65`。
- 删除 feature 或实例时，id 里可能有 `/` 和 `+`，要 URL 编码。删除整个标签页（element）需要 API key 有 Delete 权限。

## 修改已建模型
保留上次的 plan.json（或重新用模板+新参数生成），改参数后 `--replace` 重建。不要在用户手动改过的特征上直接覆盖：如果特征树里有非本 skill 前缀的特征依赖这些零件，先提醒用户。

## 坐标约定
世界 X = 左右（机构宽度），Y = 前后，Z = 上下。侧板画在平行于 Right 平面的偏移平面上，草图 x = 前后，y = 上下，枢轴在原点。

## 扩展新模板
新机构（shooter、elevator 滑块、爪子等）照 `roller_intake.py` 写一个生成 plan 的脚本，放进 `scripts/templates/` 并加到上表。
