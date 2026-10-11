import json,sys,re
for key in sys.argv[1:]:
    d=json.load(open(f'books/{key}.json')); m=d['meta']; st=d['stats']; n=len(st)
    print(f"\n######## {key}《{m['书名']}》{m['作者']}｜{m['连载状态']}｜{m['字数']}｜阅读{m['阅读量']}｜{n}章")
    print('简介:',re.sub(r'\s+',' ',m['简介'])[:350])
    dec=[]
    for k in range(5):
        seg=st[k*n//5:(k+1)*n//5]; tot=sum(s['chars'] for s in seg) or 1
        dec.append(f"{round(100*sum(s['dlg']*s['chars'] for s in seg)/tot)}%")
    print('对白占比(五段):',' '.join(dec),'| 均章字',sum(s['chars'] for s in st)//n)
    idx=sorted(set(list(range(0,min(12,n)))+list(range(12,n-6,max(1,(n-18)//22)))+list(range(max(0,n-6),n))))
    print('标题:',' / '.join(re.sub(r'^第\S+?章\s*','',st[i]['title'])[:22]+f'({i+1})' for i in idx))
    chs=[json.loads(l) for _,l in zip(range(2),open(f'books/{key}.chapters.jsonl'))]
    for c in chs:
        ls=[x for x in c['b'].split('\n') if x.strip()]
        print(f"--{c['t'][:30]}（{len(ls)}段）:", ' ‖ '.join(x[:24] for x in ls[:32]))
