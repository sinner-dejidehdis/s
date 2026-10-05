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
| intake / 滚轮吸入 / roller intake（可建造版：Part Studio + Assembly + BOM） | `scripts/templates/roller_intake.py` |
| shooter / 发射器 / 飞轮（可建造版：Part Studio + Assembly + BOM） | `scripts/templates/shooter.py` |
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

## 没有 API 密钥时（离线备选）
`pip install cadquery`，然后：
```
python scripts/export_step.py plan.json out.step
```
在 Onshape 的 Part Studio 里用 Insert / Import 上传 out.step 即可得到各个独立零件。注意这样没有草图和特征树（只是实体）；想要参数化的草图+拉伸，仍需 API 路线。

## 建模规则（自定义 plan 必读，详见 references/plan_format.md）
- 一个草图 = 一次拉伸，草图里所有闭合轮廓都会被拉伸。**孔不要和外轮廓画在同一个草图里**（会被当成实心填上）：先拉外形，再在同平面单独画孔草图，用 `"op": "remove"` 切除。
- 新零件用 `op: new`，要并入已有零件用 `add`。

## 已知限制与 API 要点
roller intake（30 个特征）和 elevator（旧版 137 个特征 + 174 个实例的装配体；加绳系后 259 个特征，**新增部分只在本地验证过，未在真实 Onshape 上建过**）都已在真实 Onshape（v6 API）上建成并全部 OK，elevator 的自制件之间做过干涉检查，特征 JSON 的写法已经按真实报错修正过。以后改 `scripts/features.py` 时注意这几点：
- 草图直线的 geometry 字段是 `pntX/pntY/dirX/dirY`。写成 `pointVector/direction` 会被静默忽略，草图显示 OK，但里面没有区域，后面的拉伸会报 ERROR。
- 平面的 `offset` 不接受负值：取绝对值，再用 `oppositeDirection` 表示方向。
- extrude 的 `defaultScope` 默认是 false，add/remove 必须设成 true，否则找不到要合并或切除的零件。对称拉伸用布尔参数 `symmetric`，不要用 `endBound`。
- 遇到 "does not match its feature spec" 时，用 `GET .../featurespecs` 查参数定义；遇到 ERROR 时，用 `POST .../featurescript` 执行 `evaluateQuery` 数一下 query 命中了几个实体。

## Intake / Shooter 模板说明（可建造版，和 elevator 同一套做法）
两个模板都用 `elevator.Plan`，生成：Part Studio 的特征（自制件带真实孔位）+ `assembly` 段（刚性组、标准件的位置和朝向，来自 `references/cots.json` 里的 MKCad 真实零件）。有 API 密钥时 `build.py plan.json --url … --replace` 一次建出零件和装配体并导出 BOM；没有密钥时用 `scripts/export_step.py`（自制件 STEP）、`scripts/plan_bom.py`（BOM CSV：自制件的材料/尺寸 + 标准件数量）、`scripts/plan_dxf.py`（侧板/电机板 1:1 DXF，英寸，可直接切割）、`scripts/render_preview.py`（带标准件包络的预览图）。

**（历年冠军设计调研见 `references/champion_designs.md`，下面的默认值已按其修改）**

**Intake**（`roller_intake.py`，默认 24" 内宽、前辊 3" + 两个 2" 滚轮、聚碳酸酯侧板、带枢轴）：两块 1/4" 侧板（1.125" 轴承孔、减重孔）+ 两根 1x2x1/16" 横管（1.5" 塞子 + 每端 2 颗 10-32x1.5"）；滚轮 = 聚碳酸酯管（1/16" 壁，包防滑带）+ 压入 hex hub（每 8" 一个）+ 1/2" hex 轴；枢轴 = 1/2" hex 轴 + 两个法兰轴承（在最后一个滚轮后面，供 slapdown/四连杆臂使用）；每轴端 1 个 COTS 法兰半 hex 轴承；每个滚轮 24T COTS 带轮，相邻滚轮 HTD5 9mm 链带（**滚轮间距会被微调 ≤0.1"，让皮带是整数齿的标准长度**，默认 85T/72T），Kraken X60 装在右板内侧、12T 在外侧 A 平面、4 颗 10-32x0.5" 固定，电机皮带 43T。B/C 两个平面交替放链带，A 放电机带。默认 12T→24T 减速 2:1（空载 3000 rpm，前辊面速约 39 ft/s、后辊 26 ft/s，高于 15 ft/s 才不会警告）。

**Shooter**（`shooter.py`，默认球径 5.9"（假设，按比赛改）、压缩 0.5"、发射角 45°、4" 飞轮 ×2、侧板内宽 8"、2:1 减速、每侧 1 个钢质惯量盘、hood 聚氨酯条）：两块 1/4" 侧板（轴承孔、**hood 弧形槽**、减重孔），hood 是 1/16" 板，两端凸片穿过侧板槽（tab-and-slot）；3 根 1x1x1/16" 横管 + 塞子 + 螺栓；hex 飞轮轴 + 铝 hub + 聚氨酯轮胎 + 两侧轴环；空转入口辊；电机侧是 `[侧板][0.8" 带区][1/4" 电机板][Kraken]`，电机板用两根立柱和 10-32x1.5" 螺栓（螺母在侧板内表面）固定；`motors=2` 两侧各一套。球夹在飞轮轮胎和 hood 之间（hood 内半径 = 飞轮半径 + 球径 − 压缩量），发射角 = `hood_end − 270°`。**cots.json 里只有 Falcon 孔的 12T 带轮，所以传动只能是减速（24T 或 36T）**，要更高转速请加大 `wheel_diameter`，或先把新的带轮加进 cots.json。

**检查**（需 cadquery，均为本地几何检查）：`tests/check_intake.py`、`tests/check_shooter.py`：自制件干涉、悬空件（皮带除外，它靠 COTS 带轮）、球放在每对滚轮上 / 沿 hood 扫过必须只接触该接触的零件；`tests/check_cots_envelopes.py --tpl roller_intake|shooter|elevator`：标准件近似包络 vs 自制件；`tests/check_plan_assembly.py`：装配描述自洽（零件名唯一、都在刚性组、标准件 key 存在）。**标准件干涉用的是近似圆柱包络；API 路线的装配体没有在真实 Onshape 上建过**，第一次真实运行请重点看装配体里的标准件朝向（轴承 hex 孔与 hex 轴是否对齐）。

**没做的**：滚轮/带轮/轴环的轴向固定件（卡簧、紧定螺钉）、皮带张紧、hood 的固定细节（目前靠槽配合）、送球通道和 indexer、入口辊驱动、抬起机构（over-the-bumper 枢轴臂）、与底盘的连接；hub 与管、hub 与轴的连接是过盈/压入，没有螺钉。

## Elevator 模板说明（可建造版：Part Studio + Assembly）
`scripts/templates/elevator.py` 生成的 plan 同时包含 Part Studio 的特征，以及 `assembly` 段（标准件清单、刚性组、slider）。`build.py` 建完零件后会接着建（或清空重建）名为 **Elevator Assembly** 的装配体，并导出 `bom_elevator.csv`。只想建零件时加 `--no-assembly`。

- **蓝本**：254 2025 Undertow 的 elevator（技术手册第 16 页）：2 级、continuous，所有级都用 2x1x1/16" 管加轴承块，2 个 Kraken X60，行程约 52"。254 在 2023 年说过刚度不足是限制他们对位速度的主要原因。
- **导向**：8 个 WCP-0199 inline 轴承块（3/4" 轴承配置，级间隙 1/4"），分别在 S0 顶、S1 底、carriage 底和顶。块的套筒插进管端，用 3 颗 10-32 螺栓穿管固定；S1 底和 carriage 的这 3 颗螺栓同时夹住角撑板或前板。WCP-0199 只配 1/16" 壁厚的管，所以固定级不再用 1/8" 壁厚。
- **结构（刚度改进）**：每一级都是闭合框。外级的顶横梁放在背面，通过侧角撑板（3/16" 铆钉）和管堵（ELV-040，等同 WCP-0374）连接，让内级可以穿过；底横梁在同一平面内，用前后两块 1/8" 角撑板加 2.5" 螺栓夹紧。满伸出时 S0 和 S1 至少重叠 `min_overlap`，超出最大行程会直接报错。
- **驱动**：2 个 Kraken X60 装在两侧 1/4" 电机板内侧，**位于滚筒正后方同高**（这样滚筒向上的绳不会穿过电机），12T→36T（HTD5 9mm，60T 皮带，3:1）带动 1/2" hex 卷筒轴，轴上两个自制 Ø1.5" × 1.5" 卷筒（带法兰，替代原来 9mm 宽的 24T 带轮：S1 行程 26" 要缠 5.5 圈，两根反向绳单层绕每根约 0.56" 宽，窄带轮放不下）。空载线速度约 157 in/s，和 254 相当。
- **绳系（continuous，每侧 4 根绳）**：S1 上行绳 = S1 底后 tab → S0 顶后轴滑轮 → 滚筒背面；S1 下行绳 = S1 顶后 tab → 滚筒正面；carriage 上行绳 = S0 底前锚 → S1 顶滑轮 → carriage 底 tab；carriage 下行绳 = S0 顶前锚 → S1 底滑轮 → carriage 顶 tab（绳穿过锚板的孔）。绳（1/16" Spectra，1" 滑轮 D/d=16）、滑轮、轴、tab、锚、夹板都是自制零件（ELV-050…074），绳归 `rigging` 组。S0 后轴是 Ø5/8" 钢轴，两端加滑轮两侧共 6 个轴环轴向定位；各 tab/锚板 1/4" 厚，S1 上行 tab 高 1"。S1 速度是 carriage 的一半，所以 `extension` 现在是 continuous 运动学：S1 走 `travel/2`，carriage 走 `travel`，且 `stage1_travel == carriage_travel == travel/2`。
- **验证**（需 cadquery，均为本地几何检查）：`tests/check_elevator.py` 在 extension=0/0.5/1 三个姿态下检查自制件两两干涉，并检查绳长不变量（上行绳缩短量 = S1 行程 = 下行绳增长量；carriage 两根绳全程长度不变）；`tests/check_cots_envelopes.py` 用螺栓头/螺母/铆钉/Kraken/带轮的近似包络检查标准件与自制件干涉；`tests/check_connectivity.py` 检查接触关系（悬空件、每根绳两端是否有落点）。强度估算（W=20 lb，S1 8 lb，6061-T6 40 ksi，钢 60 ksi，电机理论堵转 500 lbf）：所有板件堵转时 SF ≥ 1.48、正常负载 ≥ 18；5/8" 后轴堵转 SF 1.33。绳是直线段，滑轮包角和卷筒缠绕没有建模。堵转不是设计点，建议给电机设电流限制。
- **没做的**：绳在滑轮和滚筒上的包角/缠绕、卷筒绳槽和绳端固定、张紧器；真实滑轮/轴承（滑轮目前是空心圆盘，没有轴承）；卷筒的轴向固定；线缆、拖链；立柱本身只做了手算（两级悬臂 5 lb 侧向力约 0.03" 挠度，轴承块反力约 8 lb，都不是问题）；标准件干涉用的是近似包络，不是真实 CAD，要在 Onshape 里目视复查；S0 需要用户在装配体里右键 Fix，或者装到底盘上。

标准件来自 MKCad 公开库，记录在 `references/cots.json`（文档、版本、零件 id，以及零件自身坐标系）。新增标准件时，先用 bodydetails 查清它的坐标系再写进去。

## 装配体 API 要点（踩过的坑）
- 插入：`POST /assemblies/.../instances`，外部零件要带 `versionId` 和 `partId`；插入整个子装配用 `isAssembly: true`。只给 `isWholePartStudio` 时，外部文档的零件会被静默跳过。
- 定位：`POST .../occurrencetransforms` 要用 **isRelative: true**（新实例在原点，相对等于绝对）。对子装配用绝对变换会把内部零件打乱。
- 同一厂商的螺栓，不同长度的自身坐标系可能不同（MKCad 的 0.5"/2.25" 沿 Y，1.5"/2.5" 沿 X 且居中），必须逐个确认。
- 装配体里的 mate connector 用 `BTMInferenceQueryWithOccurrence-1083`，里面必须是 **`deterministicIds`（列表）**。写成单数 `deterministicId` 会一直 ERROR，也没有报错信息。面 id 从 Part Studio 的 `bodydetails` 取。
- slider 要求两个连接器的 z 轴共线；用连接器的 `transform/translationX/Y` 把其中一个平移到另一个的轴线上。刚性组用 `BTMMateGroup-65`。
- 删除 feature 或实例时，id 里可能有 `/` 和 `+`，要 URL 编码。删除整个标签页（element）需要 API key 有 Delete 权限。

## 整机布局与 FRC 规则检查（2027 BIOCORE 赛前）
`scripts/robot_layout.py`：把机架、保险杠包络、舵轮占位、shooter、带枢轴的 intake 放进同一坐标系，自动解出 intake 的**展开**和**收起**两个姿态，检查 R104/R105/R106/R107（高度、周长、伸出、一次一个方向）、干涉和重量（R103/R408）。规则放在 `references/frc_rules_2026.json`（2026 手册逐字核实；2027 手册 2027-01-09 发布后必须更新）。`scripts/render_layout.py` 画带规则界限的侧视图。耗时约几分钟（cadquery 求解）。BIOCORE 的事实、社区推测和 R302/R303 的赛前合规提醒见 `references/biocore_2027.md`，概念设计和已知问题见 `references/biocore_robot_concept.md`。intake 模板新增 `arm=true` 的过保险杠臂式布局。

## 修改已建模型
保留上次的 plan.json（或重新用模板+新参数生成），改参数后 `--replace` 重建。不要在用户手动改过的特征上直接覆盖：如果特征树里有非本 skill 前缀的特征依赖这些零件，先提醒用户。

## 坐标约定
世界 X = 左右（机构宽度），Y = 前后，Z = 上下。侧板画在平行于 Right 平面的偏移平面上，草图 x = 前后，y = 上下，枢轴在原点。

## 扩展新模板
新机构（shooter、elevator 滑块、爪子等）照 `roller_intake.py` 写一个生成 plan 的脚本，放进 `scripts/templates/` 并加到上表。
