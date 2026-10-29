// Reads a manuscript (.docx, .pdf, .txt, .md) in the browser and splits it
// into sections by their headings. Nothing is uploaded; the file stays on
// the visitor's computer. Libraries load only when a file is chosen.
(function (root) {
  const S = root.Sigao = root.Sigao || {};

  const HEADS = [
    ['abstract', /^(abstract|summary)$/],
    ['introduction', /^(introduction|background|introduction and background)$/],
    ['literature', /^(literature review|related work|previous research|theoretical (background|framework))$/],
    ['methods', /^(methods?|materials and methods|methodology|study design|research design|data and methods|participants and methods|experimental (section|procedures))$/],
    ['results', /^(results?|findings|results and analysis)$/],
    ['discussion', /^(discussion|general discussion|results and discussion)$/],
    ['conclusion', /^(conclusions?|concluding remarks|implications)$/],
    ['references', /^(references|bibliography|works cited|literature cited)$/],
    ['other', /^(acknowledge?ments?|funding|declarations?|conflicts? of interest|author contributions|data availability|appendix|supplementary materials?|ethics statement)$/],
  ];

  function headingOf(line) {
    const t = line.trim().replace(/^(\d+(\.\d+)*|[ivx]+)[.)]?\s+/i, '').replace(/[:.]$/, '').toLowerCase();
    if (!t || t.length > 60) return '';
    const h = HEADS.find(([, re]) => re.test(t));
    return h ? h[0] : '';
  }

  function split(text) {
    const out = {};
    let cur = 'front';
    String(text || '').replace(/\r/g, '').split('\n').forEach((line) => {
      const h = headingOf(line);
      if (h) { cur = h; if (!out[cur]) out[cur] = ''; return; }
      out[cur] = (out[cur] || '') + line + '\n';
    });
    Object.keys(out).forEach((k) => { out[k] = out[k].replace(/\n{3,}/g, '\n\n').trim(); });
    return out;
  }

  const paras = (t) => String(t || '').split(/\n\s*\n|\n(?=[A-Z])/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length > 40);

  // Maps the sections onto the six consistency-check fields and the reference list.
  function toProject(sec) {
    const intro = paras([sec.introduction, sec.literature].filter(Boolean).join('\n\n'));
    const aimRe = /\b(aims? (of|to)|objectives?|purpose of this|this (study|paper|article) (aims|examines|investigates|asks)|we (aim|examine|investigate|ask|test|hypothesi[sz]e))\b/i;
    const qRe = /\b(research questions?|we ask|whether|to what extent|how (does|do|can)|hypothes[ie]s)\b/i;
    const aim = intro.filter((p) => aimRe.test(p));
    const question = intro.filter((p) => qRe.test(p) && !aim.includes(p));
    const gap = intro.filter((p) => !aim.includes(p) && !question.includes(p));
    const refs = String(sec.references || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 25);
    return {
      check: {
        question: (question.length ? question : intro.slice(-1)).join('\n\n'),
        gap: gap.slice(-4).join('\n\n'),
        aim: (aim.length ? aim : intro.slice(-1)).join('\n\n'),
        method: sec.methods || '',
        results: sec.results || '',
        discussion: [sec.discussion, sec.conclusion].filter(Boolean).join('\n\n'),
      },
      refs,
      body: [sec.abstract, sec.introduction, sec.literature, sec.methods, sec.results, sec.discussion, sec.conclusion].filter(Boolean).join('\n\n'),
      found: Object.keys(sec).filter((k) => k !== 'front' && k !== 'other' && sec[k]),
    };
  }

  function load(src, check) {
    return new Promise((resolve, reject) => {
      if (check()) return resolve();
      const s = document.createElement('script');
      s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load the file reader. Check your connection.'));
      document.head.appendChild(s);
    });
  }

  async function readFile(file) {
    const name = (file.name || '').toLowerCase();
    if (file.size > 20 * 1024 * 1024) throw new Error('That file is over 20 MB. Try a smaller file.');
    if (/\.(txt|md|tex)$/.test(name)) return file.text();
    if (name.endsWith('.docx')) {
      await load('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js', () => root.mammoth);
      const r = await root.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return r.value;
    }
    if (name.endsWith('.pdf')) {
      await load('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => root.pdfjsLib);
      root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await root.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = [];
      for (let n = 1; n <= Math.min(pdf.numPages, 80); n++) {
        const c = await (await pdf.getPage(n)).getTextContent();
        let line = '', lastY = null;
        const lines = [];
        c.items.forEach((it) => {
          const y = Math.round(it.transform[5]);
          if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ''; }
          line += it.str; lastY = y;
        });
        lines.push(line);
        pages.push(lines.join('\n'));
      }
      return pages.join('\n\n').replace(/-\n(?=[a-z])/g, '');
    }
    if (name.endsWith('.doc')) throw new Error('Old .doc files cannot be read. Save it as .docx or PDF first.');
    throw new Error('Choose a .docx, .pdf or .txt file.');
  }

  S.manuscript = { split, toProject, readFile, headingOf };
})(typeof window !== 'undefined' ? window : globalThis);
