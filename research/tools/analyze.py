import os
import json,re,sys,glob,os,collections,statistics as S
UP=os.environ.get('NOVEL_DIR','novels')+'/'
STOP=set('他们 她们 我们 你们 自己 众人 对方 少年 少女 男人 女人 老者 青年 中年 那人 此人 有人 大家 所有人 两人 三人 几人 一人 老人 女子 男子 何人 这人 他人 别人 旁人 众多 只是 于是 然后 随后 顿时 立刻 忍不住 不由 微微 轻轻 淡淡 冷冷 缓缓 连忙 赶紧 直接 再次 突然 依旧 终于 已经 正在 还是 只能 不禁 也是 就是 却是 便是 都是 可是 但是 所以 因为 如果 虽然 这个 那个 什么 怎么 这样 那样 如此 一样 一声 一句 一下 一眼 一阵 一边 一时 时候 这时 此时 同时 心中 心里 脸上 眼中 嘴角 身后 身前 面前 旁边 一旁 周围 不少 很多 许多 有些 没有 不是 不会 不能 可以 应该 知道 觉得 看到 听到 说话 开口 回答 问题 声音 笑容 表情 目光 眼神 视线 系统 提示 玩家 主人 先生 小姐 老师 同学 大人 前辈 师父 师兄 师姐 少爷 公子 姑娘 老板 队长 局长 长官 医生 护士 校长 班长 弟弟 妹妹 哥哥 姐姐 爸爸 妈妈 父亲 母亲 爷爷 奶奶 老头 小子 兄弟 家伙 东西 这里 那里 哪里 怎样 这么 那么 多少 为何 为什么 不过 而且 并且 或者 还有 甚至 尤其 毕竟 似乎 好像 仿佛 果然 竟然 居然 显然 当然 其实 确实 真是 真的 不错 好了 行了 对了 算了 是吗 不好 好的 起来 下来 出来 过来 回来 进来 上来 不知 一道 无数 亿万 有什么 没什么 难道 随即 比如 下意识 继续 漠然 获得 这话 我知 你知 他知 他不知 平静 转头 再度 抬头 急忙 当即 摇头 疑惑 认真 无奈 解释 淡笑 提醒 地说 一会儿 开口说 有一 将这 而后 笑一声 专属 化作一 时间之 这一 那一 不得不 自选 更不用 美人生 抬起头 并没有 不住地 有所思 谁知 多谢 特殊 一个 人间 低声 轻声 出声 沉声 悠悠 笑呵呵 息一声 词条 脑海中 门经理 斤车之 备增幅 之前 神通大'.split())
SV='冷笑|笑道|笑着|淡淡道|淡淡|沉声|开口|说道|问道|喝道|叹道|怒道|皱眉|点头|摇头|看着|看向|轻声|低声|大喊|喊道|咬牙|苦笑|嘿嘿|哼了|愣住|一愣|眯眼|瞪大|说|道|问|喝|叹'
nm=re.compile(r'([一-龥]{2,3})(?:'+SV+')')
def ending(l):
    l=l.strip()
    if l.endswith(('”','」','』')): return '对白收尾'
    if re.search(r'[？?]$',l): return '问句'
    if re.search(r'[！!]$',l): return '感叹'
    if re.search(r'(……|\.\.\.|…|——)$',l): return '省略/破折'
    if l.startswith('【') or l.endswith('】'): return '系统框'
    if len(l)<=10: return '短句断点'
    return '叙述'
def run(key):
    d=json.load(open(f'books/{key}.json')); m=d['meta']
    chs=[json.loads(l) for l in open(f'books/{key}.chapters.jsonl')]
    n=len(chs); lens=[len(c['b'].replace('\n','')) for c in chs]
    seg=lambda arr,k=10:[arr[i*len(arr)//k:(i+1)*len(arr)//k] for i in range(k)]
    out={'key':key,'书名':m['书名'],'作者':m['作者'],'状态':m['连载状态'],'字数':m['字数'],'阅读量':m['阅读量'],'章数':n}
    out['章长']={'均':sum(lens)//n,'p10':sorted(lens)[n//10],'中位':int(S.median(lens)),'p90':sorted(lens)[9*n//10],
                 '十段均值':[sum(s)//max(1,len(s)) for s in seg(lens)]}
    dl=[];sysl=[];utt=[];ends=collections.Counter();ends10=[];verbs=collections.Counter()
    for i,c in enumerate(chs):
        b=c['b'];L=max(1,len(b.replace('\n','')))
        u=re.findall(r'“([^”]*)”',b); utt+=u
        dl.append(sum(len(x)+2 for x in u)/L)
        lines=[x for x in b.split('\n') if x.strip()]
        sysl.append(sum(1 for x in lines if x.strip().startswith('【'))/max(1,len(lines)))
        if lines:
            e=ending(lines[-1]); ends[e]+=1
            if i<10: ends10.append(e)
        for v in re.findall(r'(冷笑|笑道|淡淡道|沉声道|说道|问道|喝道|叹道|怒道|苦笑|低声道|轻声道|开口道|咬牙道|嘿嘿一笑|皱眉道|点头道)',b): verbs[v]+=1
    out['对白占比十段']=[round(100*sum(s)/max(1,len(s))) for s in seg(dl)]
    out['系统框行占比%']=round(100*sum(sysl)/n,1)
    out['台词']={'条数':len(utt),'均长':round(sum(map(len,utt))/max(1,len(utt)),1),
              '≤10字%':round(100*sum(1 for x in utt if len(x)<=10)/max(1,len(utt))),
              '含问号%':round(100*sum(1 for x in utt if '？' in x or '?' in x)/max(1,len(utt))),
              '含叹号%':round(100*sum(1 for x in utt if '！' in x or '!' in x)/max(1,len(utt))),
              '每千字台词条数':round(1000*len(utt)/max(1,sum(lens)),1)}
    out['说话动词Top']=verbs.most_common(8)
    out['章末类型分布%']={k:round(100*v/n) for k,v in ends.most_common()}
    out['前10章章末']=ends10
    # characters
    cand=collections.Counter()
    for c in chs: 
        for x in nm.findall(c['b']): 
            if x not in STOP and not re.search(r'[的了着是在和就也都很又把被让给对向从]',x): cand[x]+=1
    # merge: prefer 3-char if its 2-char prefix also candidate
    top=[w for w,_ in cand.most_common(60)]
    chars=[]
    for w in top:
        if any(w!=o and w in o and cand[o]>=cand[w]*0.6 for o in top): continue
        if any(h['名'] in w or w.startswith(h['名'][-1]) for h in chars): continue
        cnt=[c['b'].count(w) for c in chs]; tot=sum(cnt)
        if tot<max(30,n//10): continue
        first=next(i for i,x in enumerate(cnt) if x>0)+1
        dist=[round(100*sum(s)/tot) for s in seg(cnt)]
        chars.append({'名':w,'提及':tot,'首现章':first,'十段分布%':dist,'出场章数':sum(1 for x in cnt if x>0)})
        if len(chars)>=18: break
    out['人物']=sorted(chars,key=lambda x:-x['提及'])
    # volume markers
    raw=open(glob.glob(UP+key+'*.txt')[0],encoding='utf-8',errors='ignore').read()
    out['卷标记']=re.findall(r'\n\s*(第[0-9一二三四五六七八九十百]+卷[^\n]{0,20})',raw)[:30]
    tl=[c['t'] for c in chs]
    out['标题']={'均长':round(sum(len(re.sub(r'^第\S+?章\s*','',t)) for t in tl)/n,1),
              '含！%':round(100*sum('！' in t or '!' in t for t in tl)/n),'含？%':round(100*sum('？' in t or '?' in t for t in tl)/n),
              '含加更/求票%':round(100*sum(bool(re.search('加更|求|月票|爆更|大章|二合一',t)) for t in tl)/n)}
    json.dump(out,open(f'books/{key}.metrics.json','w'),ensure_ascii=False,indent=1)
    return out
if __name__=='__main__':
    keys=sys.argv[1:] or [os.path.basename(f)[:8] for f in glob.glob('books/*.json') if 'metrics' not in f]
    for k in keys:
        o=run(k); print(k,o['书名'],'人物:',[c['名'] for c in o['人物']][:10],'卷:',len(o['卷标记']))
