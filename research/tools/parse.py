import os
import re,os,json,glob,sys
UP=os.environ.get('NOVEL_DIR','novels')+'/'
OUT='books/'
os.makedirs(OUT,exist_ok=True)
chre=re.compile(r'^第([0-9零一二三四五六七八九十百千两]+)章\s*(.*)$')
rows=[]
for f in sorted(glob.glob(UP+'*.txt')):
    key=os.path.basename(f)[:8]
    t=open(f,encoding='utf-8',errors='ignore').read()
    sep=t.find('————————')
    head=t[:sep] if sep>0 else t[:3000]
    meta={}
    for k in ['书名','作者','连载状态','字数','章节数','阅读量']:
        m=re.search(k+r'：(.*)',head); meta[k]=m.group(1).strip() if m else ''
    m=re.search(r'【简介】\s*(.*)',head,re.S); meta['简介']=m.group(1).strip() if m else ''
    lines=t[sep:].split('\n') if sep>0 else t.split('\n')
    chs=[];cur=None
    for l in lines:
        s=l.strip()
        mm=chre.match(s)
        if mm and len(s)<60:
            cur={'title':s,'body':[]};chs.append(cur);continue
        if cur is None or not s or s.startswith('章节更新时间') or s.startswith('————'): continue
        cur['body'].append(s)
    stats=[]
    for i,c in enumerate(chs):
        body='\n'.join(c['body']); n=len(body.replace('\n',''))
        dl=sum(len(x) for x in re.findall(r'“[^”]*”',body))
        paras=len(c['body'])
        stats.append({'i':i+1,'title':c['title'],'chars':n,'dlg':round(dl/max(n,1),3),'paras':paras,
                      'excl':body.count('！')+body.count('!'),'q':body.count('？')+body.count('?')})
        open(f'{OUT}{key}_{i+1:04d}.txt','w').write(body) if False else None
    json.dump({'key':key,'meta':meta,'stats':stats},open(f'{OUT}{key}.json','w'),ensure_ascii=False)
    # store chapters in one jsonl for random access
    with open(f'{OUT}{key}.chapters.jsonl','w') as w:
        for c in chs: w.write(json.dumps({'t':c['title'],'b':'\n'.join(c['body'])},ensure_ascii=False)+'\n')
    n=len(stats); tot=sum(s['chars'] for s in stats)
    avg=tot//max(n,1); dlg=sum(s['dlg']*s['chars'] for s in stats)/max(tot,1)
    avgpara=tot/max(1,sum(s['paras'] for s in stats))
    rows.append((key,meta['书名'],meta['连载状态'],meta['字数'],meta['阅读量'],n,avg,round(dlg*100),round(avgpara,1)))
print('key\t书名\t状态\t字数\t阅读量\t解析章数\t均章字\t对白%\t段均字')
for r in rows: print('\t'.join(map(str,r)))
