# Arguo 推广素材包：Reddit 回答 + AI 工具目录

链接都带了来源标记，之后可以在 Supabase 里按来源查看访问量。

---

## 一、Reddit 回答模板

**用法：**
1. 在下列版块搜关键词，找**最近一周、还没有好答案**的帖子：
   - 版块：r/college、r/GradSchool、r/PhD、r/AskAcademia、r/ChatGPT、r/Professors、r/studytips
   - 关键词：`fake citations`、`ChatGPT references`、`sources don't exist`、`cite APA`、`reference list format`、`discussion section`
2. 先用心回答对方的问题，**链接放在最后一句**，并说明是你做的。
3. 每天最多回答 2 到 3 个帖子，不要重复粘贴同一段话，按原帖内容改写几句。

### 1. "ChatGPT 给的参考文献是假的 / 查不到"
> This happens a lot: language models generate references that look real but don't exist, or mix up authors and years. A few ways to check:
> 1. Paste the title into Google Scholar in quotes. If nothing comes up, be suspicious.
> 2. If it has a DOI, open `doi.org/<the DOI>`. A fake DOI goes nowhere or to a different paper.
> 3. Check that the first author and year match the real record; that's where AI usually slips.
>
> If you have a long list, I built a free checker that looks up every reference in Crossref at once and flags the ones that don't exist or have wrong details (no sign-up): https://arguolucid.arguolucid.workers.dev/citation-checker/?utm_source=reddit
> Disclosure: I made it, so feedback is welcome.

### 2. "怎么把参考文献转成 APA 或某个期刊的格式"
> If your references have DOIs, the fastest route is to let Crossref generate the formatted citation in the exact style (APA 7, Vancouver, or a specific journal's style), rather than retyping. Zotero can do this too if your library is already there.
>
> I made a free tool that takes a list of DOIs, lets you pick any of 10,000+ journal styles, and gives you the formatted list to copy: https://arguolucid.arguolucid.workers.dev/reference-formatter/?utm_source=reddit
> (I built it, so tell me if anything is off.)

### 3. "教授说我的 discussion 过度推断了 / overclaiming"
> The usual fix: go sentence by sentence through your discussion and, for each claim, point to the exact result that supports it. If you can't, either cut it, soften it ("may", "is associated with"), or move it to future research. Watch for causal verbs (causes, leads to, improves) if your design is a survey or correlational, and make sure you have a limitations paragraph.
>
> I built a free tool that does this check automatically: it flags discussion sentences with no supporting result, causal wording on correlational data, and missing limitations. It never rewrites anything for you: https://arguolucid.arguolucid.workers.dev/?utm_source=reddit

### 4. "我能用 AI 帮忙写论文吗？会不会违反学术诚信"
> Check your course syllabus or the journal's AI policy first. Most allow tools that give feedback but not ones that write text for you, and many require you to disclose AI-written text.
>
> A safe middle ground is a tool that only points out problems and explains how to fix them, so all the writing stays yours. That's why I built Arguo: it checks references, wording and whether your sections line up, but never writes a sentence: https://arguolucid.arguolucid.workers.dev/?utm_source=reddit

### 5. "怎么找某个题目的相关文献 / 不知道从哪里开始"
> Start from a recent review article on your topic, then follow its references backward and "cited by" forward in Google Scholar. That gives you both the foundations and the newest work.
>
> I made a free tool where you can ask your question in plain words; it finds relevant recent papers (with links) and can follow their citations to find more: https://arguolucid.arguolucid.workers.dev/gap-finder/?utm_source=reddit

---

## 二、AI 工具目录提交文案

**要提交的网站**（都免费，各自注册账号提交）：
- There's An AI For That: theresanaiforthat.com，点 Submit
- Futurepedia: futurepedia.io，点 Submit a tool
- Toolify: toolify.ai，点 Submit AI Tools
- AlternativeTo: alternativeto.net。提交时登记为 Elicit、Grammarly、Zotero 的替代品
- SaaSHub: saashub.com
- Product Hunt: producthunt.com。建议等域名和功能稳定后再做一次正式发布

**通用填写内容：**
- **Name:** Arguo
- **URL:** `https://arguolucid.arguolucid.workers.dev/?utm_source=directory`
- **Tagline**（60 字符以内）: Checks your research paper. Never writes it.
- **Category:** Education / Research / Writing assistant
- **Pricing:** Free
- **Tags:** citation checker, academic writing, research, references, literature search, students

**Short description（约 160 字符）：**
> Arguo checks academic papers without writing them: verifies every reference against Crossref, formats citations for 10,000+ journals, and flags overclaiming.

**Long description：**
> Arguo is a free writing-feedback tool for students and researchers that deliberately never generates text, so it's safe under strict AI policies.
>
> - **Citation checker:** verifies every reference against Crossref and flags citations that don't exist or have wrong authors or years, which is common with ChatGPT.
> - **Reference formatter:** formats DOIs in any of 10,000+ journal styles.
> - **Full paper review:** checks a whole manuscript section by section (abstract to conclusion) and across sections: abstract numbers vs. results, sample sizes, aims vs. conclusion, in-text citations vs. reference list.
> - **Published examples:** shows how similar open-access papers wrote the same section, with full citations.
> - **Literature search by meaning**, evidence tables and citation chasing.
> - **Word add-in, Zotero and EndNote import/export.**
>
> It points out problems, explains how to fix them and shows examples from other topics. The writing stays yours.

---

## 三、给写作课老师的邮件

- 已在你的 Gmail 草稿箱里放好 3 封，收件人是官网上核实过的写作项目负责人：
  - Fred Siegel：Drexel 一年级写作项目主任
  - Dan Driscoll：Drexel 大学写作项目联合主任
  - Amy Anderson：West Chester 一年级写作项目主任
- 发送前请逐封检查。**每天最多发 5 封。**
- 继续找人的方法：在大学官网的 English 或 Writing Program 页面找 "Director of First-Year Writing" / "Writing Program Director"，**只用官网上列出的个人邮箱**。
