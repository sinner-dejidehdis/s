# plan.json 格式

```json
{"name": "demo", "tag": "demo", "units": "in",
 "expect": {"bbox_in": [宽X, 前后Y, 高Z]},      // 可选，建完后与包围盒比对
 "steps": [ ... ]}
```
`tag` 决定特征名前缀 `[tag] `，`--replace` 只删除同 tag 的特征。`units`: `in` | `mm`。

## steps（按顺序执行，id 唯一）

**plane**（偏移基准面）
`{"type":"plane","id":"p1","base":"Right","offset":1.5,"name":"..."}`
base = Top / Front / Right 或先前 plane 的 id。offset 沿平面法向。

**sketch**（在 plane 上画草图，坐标为草图局部 x,y）
`{"type":"sketch","id":"s1","plane":"p1","name":"...","entities":[...]}`
- `{"kind":"polygon","points":[[x,y],...]}`  自动闭合，按顺序连线
- `{"kind":"rect","corner":[x,y],"size":[w,h]}`
- `{"kind":"circle","center":[x,y],"radius":r}`

各基准面的草图坐标 → 世界坐标：
| 平面 | 草图 x | 草图 y | 法向 |
|---|---|---|---|
| Top | X | Y | +Z |
| Front | X | Z | −Y |
| Right | Y | Z | +X |

**extrude**
`{"type":"extrude","id":"e1","sketch":"s1","depth":0.25,"direction":"normal|flip|symmetric","op":"new|add|remove|intersect"}`
- normal = 沿平面法向；flip = 反向；symmetric = 两侧各 depth/2。
- `"hollow": true`：只拉伸环形区域，草图里的内轮廓保持空心。方管（外矩形 + 内矩形）和带孔的板都用这种写法，一步完成，不会误切到别的零件。
- 一个 sketch 对应一次 extrude；孔用单独的 sketch + `remove`（见 SKILL.md）。

## 模板
`scripts/templates/roller_intake.py --set key=value`，参数见文件顶部 DEFAULTS。
