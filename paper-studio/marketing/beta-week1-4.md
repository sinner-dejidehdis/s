# Arguo 内测行动包：第 1–4 周

目标：**50 位真实用户、20 条深度反馈**，并验证一个关键数字：打开示例项目的人里，**超过 30%** 用过一次 AI。

网站：https://arguolucid.arguolucid.workers.dev
免费工具：`/citation-checker/` · `/reference-formatter/` · `/gap-finder/`

---

## 每周节奏（每天约 30–45 分钟）

| 周 | 重点 | 具体要做的 |
|---|---|---|
| 第 1 周 | 身边的人 | 私信 15–20 位博士生、博士后、导师；约 5 人做 15 分钟试用访谈 |
| 第 2 周 | 修问题 + 开社交账号 | 把第 1 周发现的问题告诉我来修；注册 Bluesky 和 X，发前 3 条内容 |
| 第 3 周 | Reddit 和社区 | 在允许的版块发求反馈帖；在相关问题下真诚回答 |
| 第 4 周 | 复盘 | 看数据和反馈，决定是否投入付费 AI、域名和公开发布 |

---

## 一、私信（第 1 周）

### 发给同学、实验室成员

> Hi [name]! I've been building a small tool for paper writing and I'd love your honest opinion. It checks your references against Crossref (catches made-up citations), formats them for any journal, and flags where your discussion claims more than your results show. It never writes text for you.
>
> Could you try the free citation checker on one of your reference lists? Takes 2 minutes: https://arguolucid.arguolucid.workers.dev/citation-checker/
>
> If you have 15 more minutes, I'd really value watching you try the full workspace over a call. Totally fine if not!

### 发给导师、老师

> Dear Prof. [name], I'm developing Arguo, a writing-feedback tool for researchers that deliberately never generates text, so students can use it without AI-disclosure concerns. It verifies references, checks that methods, results and discussion are consistent, and adapts the submission checklist to the target journal.
>
> Would you be willing to look at it for 10 minutes, or share it with a student who is drafting a paper? Any criticism would help: https://arguolucid.arguolucid.workers.dev

---

## 二、15 分钟试用访谈（第 1–2 周，目标 5–8 人）

**规则**：只看不教。对方卡住时不要马上帮忙，先问"你现在在想什么？"。

1. （1 分钟）你最近一次写论文，最花时间、最烦的是哪一步？
2. （2 分钟）请打开首页。你觉得这个网站是做什么的？会先点哪里？
3. （5 分钟）请用 Citation Checker 检查你自己的一段参考文献。
4. （5 分钟）打开示例项目，进入 Consistency check，点一次 AI 按钮。读完批注，你会怎么改？
5. （2 分钟）
   - 如果明天这个工具消失了，你会有多失望？（非常失望 / 有点失望 / 无所谓）
   - 你愿意每月付多少钱？（0 / $5 / $10 / $20）
   - 你会推荐给谁？

记录在下面的表格里，每次访谈一行：

| 日期 | 身份/学科 | 最大痛点 | 卡住的地方 | 最喜欢的功能 | 消失会多失望 | 愿付价格 | 原话摘录 |
|---|---|---|---|---|---|---|---|

> 判断标准：如果超过 40% 的人回答"非常失望"，说明产品方向对了，值得投入。

---

## 三、Bluesky 和 X 内容日历（第 2–4 周，每周 3 条）

学术圈在 Bluesky 上很活跃。发帖时加 #AcademicSky、#PhDLife、#AcademicWriting，并关注学科相关的 Starter Pack（关注列表合集）。**每条以干货为主，结尾才提工具，大约一半的帖子不提工具。**

**第 2 周**

1. > In a 2025 study (JMIR Mental Health), GPT-4o fabricated about 1 in 5 of the references it gave for literature reviews, and many of the rest had errors. Before you submit, check every reference against Crossref. I built a free checker that does it in seconds: [citation-checker link]
2. > The most common reason a discussion gets torn apart in review: it claims things the results never measured. Test: for every sentence in your discussion, point to the result that supports it. If you can't, cut it or turn it into future work.
3. > A research gap has four parts: what is known (with citations) → what is missing (be specific) → why it matters → therefore this study. Most drafts skip the third.

**第 3 周**

4. > "Associated with" ≠ "causes". If your design is cross-sectional or survey-based, swap every causal verb (causes, leads to, damages) for associational ones and say why in your limitations.
5. > Reformatting references for a new journal after a desk rejection is the worst. Paste your DOIs, pick the journal, copy the list: [reference-formatter link] (10,000+ journal styles, free)
6. > Reviewers read your limitations section as a test of honesty. Name 2–3 real limitations, say how each might affect your results, and how future work could fix it.

**第 4 周**

7. > Starting a new project? Type your topic and see the most relevant papers from the last 5 years, with a short map of the open questions, citing only real papers: [gap-finder link]
8. > Vague reviewer comment like "the discussion needs strengthening"? Write down 2–3 ways to read it, pick one, and say in your response which reading you addressed.
9. > I'm building Arguo, a paper-checking tool that never writes your text. 4 weeks of testing, [N] researchers so far. What should a tool like this check that nothing else does? Replies very welcome.

---

## 四、Reddit（第 3 周）

**先读版规。** r/PhD、r/GradSchool、r/AskAcademia 大多**禁止自我推广**，在里面直接发工具会被删帖，甚至封号。做法分两种：

**A. 允许发项目的版块**：可以直接发帖求反馈，例如 r/SideProject、r/alphaandbetausers、r/indiehackers。另外也留意各学科版块每周固定的"自我推广帖"（self-promotion thread），在那里发。

> **Title:** I built a free tool that checks whether your references are real (and never writes your text)
>
> After seeing AI chatbots invent citations in friends' drafts, I built Arguo. The free citation checker looks up every reference in Crossref and flags ones that don't exist or have wrong details. The full workspace also checks that your methods, results and discussion line up, and formats references for 10,000+ journals.
>
> It deliberately never generates text, so there's nothing to disclose to journals.
>
> I'd love blunt feedback: what's confusing, what's missing, what would make you use it? [link]

**B. 学术版块**：只在有人问到相关问题时认真回答，比如"怎么检查 AI 生成的参考文献？"、"怎么快速换期刊格式？"。先给出完整的方法，最后一句再提："Disclosure: I built a free tool for this: [link]"。每周最多 2 次。

---

## 五、每周看的数据

每周一在 Supabase → SQL Editor 运行下面的查询（analytics.sql 底部也有）：

```sql
select date_trunc('week', created_at)::date as week,
  count(distinct session) filter (where name = 'visit')         as visitors,
  count(distinct session) filter (where name = 'open_sample')   as opened_example,
  count(distinct session) filter (where name = 'ai_used')       as used_ai,
  count(distinct session) filter (where name like 'tool_%')     as used_free_tools,
  count(*)                filter (where name = 'signup')        as signups,
  count(*)                filter (where name = 'feedback')      as feedback
from public.events group by 1 order by 1 desc;
```

| 指标 | 第 4 周目标 | 没达到时怎么办 |
|---|---|---|
| 访客 | 300+ | 多发帖、多私信 |
| 打开示例 ÷ 访客 | > 25% | 首页没讲清楚，改标题和按钮 |
| 用过 AI ÷ 打开示例 | > 30% | AI 按钮不够显眼，或示例不吸引人 |
| 免费工具使用人数 | 100+ | 工具链接发得不够多 |
| 注册 | 30+ | 云端保存的好处没讲清楚 |
| 反馈条数 | 20+ | 在帖子和私信里主动请人点 Feedback |
| 访谈中"非常失望"的比例 | > 40% | 低于这个比例，先回头改产品，暂不扩大推广 |

另外每天看一次 **Table Editor → feedback**，有 bug 当天告诉我修。

---

## 六、第 4 周结束时的决定

- **数据达标**：开通 Groq 付费版（预计每月 $20–60），买域名，接 Resend 邮件，进入第 5–8 周的公开发布（Product Hunt、Hacker News）。
- **数据没达标**：把反馈和访谈记录交给我，先改产品，再测 2 周。
