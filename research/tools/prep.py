import json,sys,re
key=sys.argv[1]; N=int(sys.argv[2]); extra=[int(x) for x in sys.argv[3].split(',')] if len(sys.argv)>3 and sys.argv[3] not in ('','auto') else None
m=json.load(open(f'books/{key}.metrics.json'))
chs=[json.loads(l) for l in open(f'books/{key}.chapters.jsonl')]
import os
CAP=int(os.environ.get('CAP','0'))
if CAP:
    for c in chs:
        if len(c['b'])>CAP: c['b']=c['b'][:CAP]+'\n……（本章过长，后文截断）'
if extra is None:
    n=len(chs); fa=sorted(set(c['首现章'] for c in m['人物'] if c['首现章']>N))[:5]
    ev=[int(n*p) for p in (0.2,0.35,0.5,0.65,0.8,0.92)]
    extra=sorted(set(x for x in fa+ev if N<x<=n-2))
    print('extra',extra)
o=open(f'dl/deep_{key}.txt','w')
o.write(json.dumps({k:v for k,v in m.items()},ensure_ascii=False)+'\n\n')
o.write('【全部标题】\n'+' / '.join(f"{i+1}.{re.sub(r'^第\S+?章\s*','',c['t'])}" for i,c in enumerate(chs))+'\n\n')
for i in range(min(N,len(chs))):
    o.write(f"\n=====【第{i+1}章全文】{chs[i]['t']}\n"+chs[i]['b']+'\n')
for e in extra:
    if 1<=e<=len(chs):
        ls=[x for x in chs[e-1]['b'].split('\n') if x.strip()]
        o.write(f"\n=====【抽读 第{e}章 前60段】{chs[e-1]['t']}\n"+'\n'.join(ls[:60])+'\n')
for i in range(max(N,len(chs)-2),len(chs)):
    o.write(f"\n=====【结尾章 第{i+1}章】{chs[i]['t']}\n"+chs[i]['b']+'\n')
o.close()
import os;print(os.path.getsize(f'dl/deep_{key}.txt'))
