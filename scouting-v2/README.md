# REBUILT Scout v2

第二版。代码全部自己写，没有复制其他队伍的代码、图片或队标。

借鉴的是 ScoutingPASS（FRC 2451）这类网页 scouting 工具的使用流程：
- 分页填写：Pre-match → Auto → Teleop → Endgame → Post-match → 二维码
- 字段由配置决定
- 可以在场地图上点选位置
- 计数器带 +1/+5/+10
- 二维码内容是制表符分隔的一行，能直接粘贴进表格

第一版在 `../scouting/`，没有改动。

## 页面

- **Match**：一名记录员盯一台机器人，按页面顺序填完后显示二维码。
  - 在 Settings 里导入赛程后，选好位置（Red 1 … Blue 3）队号会自动填。
  - 场地图点一下标记起始位置；Auto 和 Teleop 可以连续点，标记射球位置。
- **Pit**：机器参数，同样生成二维码。
- **Data**：负责人用。
  - 点进文本框，用 USB 扫码枪逐个扫码，每扫一个自动导入。
  - 队伍表格可以排序；点队号能看射球热力图、Pit 信息和备注。
  - 「Copy match data」复制带表头的 TSV，可以直接粘贴进 Google Sheets 或 Excel。
- **Settings**：赛事代码、赛程 CSV、场地图左右翻转。

## 改字段

只改 `js/config.js` 就行。每个字段的 `code` 就是导出时的列；列的顺序按配置里的顺序。

注意：改了字段，旧版本生成的二维码就读不进来了，因为列数会对不上。

## 测试

```bash
node --test scouting-v2/tests/*.test.js
```

场地图是自己画的示意图，比例不准，只用来标相对位置。
