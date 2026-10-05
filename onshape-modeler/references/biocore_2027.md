# 2027 赛季（BIOCORE presented by Haas）调研与设计前提

更新时间：2026-10（官方规则 2027-01-09 发布，之后本文件必须按新手册重写）。

## 已确认的事实（官方来源）
- 游戏名 **BIOCORE presented by Haas**，**2027 年 1 月 9 日 12:00 ET** 在 FIRST Robotics Competition YouTube 频道发布。
  官方原文："a new challenge releasing January 9, 2027 … delve into the heart of what sustains life on Earth."
  来源：[FIRST 游戏与赛季页面](https://www.firstinspires.org/programs/frc/game-and-season)
- 赛季主题 **FIRST CANOPY**，生物多样性（"Nothing on Earth thrives alone. Every gene, species, and ecosystem is part of a rich web of biological diversity…"）。
  来源：[FIRST CANOPY](https://www.firstinspires.org/first-canopy)
- 官方页面**没有**给出任何玩法、比赛道具、场地或得分信息。

## 社区推测（不是事实）
[Chief Delphi 的 2027 预测帖](https://www.chiefdelphi.com/t/2027-game-predictions-biocore-presented-by-haas/519808?page=10)里的猜测：
"种子"作为比赛道具（泡沫橄榄球形、球、PVC 管等多种形状）、放置到管/架里的 pick-and-place、因为 canopy 而出现悬挂式爬升。
我没有任何内部消息，**无法预测真实玩法**；下面的设计是"对多种可能玩法都有用的平台"，不是对某个具体猜测的押注。

## 规则基准（2026 手册，逐字核实，见 `frc_rules_2026.json`）
| 规则 | 内容 |
|---|---|
| R103 | 机器人重量 ≤ 115.0 lb（不含保险杠、电池及其 Anderson 半边、定位标签） |
| R408 | 含保险杠 ≤ 135.0 lb |
| R104 | 起始构型周长 ≤ 110.0 in，高度 ≤ 30 in |
| R105 / R106 | 超出周长的水平伸出 ≤ 12 in，且同一时刻只能向一个方向伸出 |
| R107 | 总高度 ≤ 30.0 in |
| R401–R405 | 保险杠：护住整个周长，≥ 2.25 in 泡沫、≥ 4.5 in 高，伸出周长 ≤ 4.0 in，保险杠区 2.5–5.75 in |
| R502 | 推进电机 ≤ 4 个（"propulsion motor" 的定义我没核实，舵向电机是否计入请查手册） |
| R807 / R808 | 气压：储气 ≤ 120 psi，工作 ≤ 60 psi |
| R301 | 单个非 KOP 零件/软件公允市价 ≤ 600 美元 |
| **R302** | "MAJOR MECHANISMS … created before Kickoff are not permitted." |
| **R303** | 赛前创建的机器人软件和设计，**只有在赛前公开了源文件**时才被允许 |

**这些数字是 2026 赛季的，2027 手册会重新规定。**尤其 30 in 的高度限制很可能是 2026 赛季游戏（场地结构）特有的，往年上限不同，
2027 年很可能改变。本仓库的检查工具把限值放在 JSON 里，规则公布后只需改这一个文件。

## 对"赛前设计"最重要的合规提醒
- 若要用于正式比赛：**R303** 要求这份设计的源文件在 Kickoff 之前公开；**R302** 要求不能在 Kickoff 前制造"主要机构"（解释为"为解决至少一个比赛挑战而组装的一组零部件"）。
  即：现在可以画 CAD、写代码并公开，但**不要加工 intake / shooter / 升降机构**，等 1 月 9 日之后再做。
- 如果只是练习或学习，不受影响。
- 具体适用方式请以 2027 年手册和你们队的技术指导/裁判为准，我没有替你们做合规裁定。
