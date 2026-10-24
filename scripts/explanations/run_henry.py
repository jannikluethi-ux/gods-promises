import json,select_henry as S
P=json.load(open('/workspace/gods-promises/promises.json'))['promises']
out={};rep=[]
for p in P:
    try: r=S.pick(p['book'],p['chapter'],p['verseStart'],p['verseEnd'],p['text'])
    except Exception as e:
        print('ERR',p['id'],e); r=None
    if r: out[p['id']]=r
    else: rep.append(p['id'])
FALLBACK={'psa-108-12-13':('Psalms',60,11,12)}
for pid,(bk,c,a,z) in FALLBACK.items():
    if pid not in out:
        pp=[p for p in P if p['id']==pid][0]
        r=S.pick(bk,c,a,z,pp['text']); r['fallback']=f'{bk} {c}:{a}-{z}'; out[pid]=r; rep.remove(pid)
json.dump(out,open('henry_full.json','w'),ensure_ascii=False,indent=1)
import statistics as st
W=[r['words'] for r in out.values()]
print('got',len(out),'missing',rep)
print('words median',st.median(W),'min',min(W),'max',max(W),'<40',sum(w<40 for w in W),'>110',sum(w>110 for w in W))
print('copy>0.3',[(k,r['copy']) for k,r in out.items() if r['copy']>0.3])
print('low overlap',sum(1 for r in out.values() if r['overlap']<1.0))

d={k:out[p['id']]['text'] for p in P for k in [p['id']] if k in out}
open('/workspace/gods-promises/data/henry.json','w').write(json.dumps(d,ensure_ascii=False,separators=(',',':')))
