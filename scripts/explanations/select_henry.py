import re,json,math
from mhcc import passages, VC
from modern import modernize
KJV=json.load(open('/workspace/hb/kjv.json'))
SW={'I Samuel':'1 Samuel'}
def sword_book(b):
    m=re.match(r'^([123]) (.*)$',b)
    if m: b={'1':'I','2':'II','3':'III'}[m.group(1)]+' '+m.group(2)
    if b=='Revelation': b='Revelation of John'
    return b
STOP=set('''a an the and or but of to in on at by for with from as is are was were be been being it its this that these those he she
they them his her their him we us our you your i me my mine not no nor so if then than there here what which who whom whose when where
why how all any some such shall will would should may might can could do does did done have has had having thee thou thy thine ye hath
doth unto upon also even yea lord god said says saith say one into out up down very more most much many let o oh behold therefore
because thus every own make made being own same other let us shall''' .split())
def stem(w):
    w=w.lower()
    for suf in ('eth','est','ing','edly','ed','es','s','ly'):
        if len(w)-len(suf)>=4 and w.endswith(suf): return w[:-len(suf)]
    return w
def toks(s):
    return [stem(w) for w in re.findall(r"[A-Za-z']+",s) if w.lower() not in STOP and len(w)>2]
ABBR=r'(?:Ge|Gen|Ex|Exo|Le|Lev|Nu|Num|De|Deut|Jos|Josh|Jud|Jg|Ru|Sa|Ki|Ch|Chr|Ezr|Ne|Neh|Es|Est|Job|Ps|Psa|Pr|Prov|Ec|Eccl|So|Song|Isa|Is|Jer|Jr|La|Lam|Eze|Ezek|Da|Dan|Ho|Hos|Joe|Am|Ob|Jon|Mic|Na|Nah|Hab|Zep|Zeph|Hag|Zec|Zech|Mal|Mt|Matt|Mr|Mk|Mark|Lu|Lk|Luke|Joh|Jn|John|Ac|Acts|Ro|Rom|Co|Cor|Ga|Gal|Eph|Php|Phil|Col|Th|Thess|Ti|Tim|Tit|Phm|Heb|Jas|Jam|Pe|Pet|Jo|Jude|Re|Rev)'
REFPAT=re.compile(r'\s*,?\s*\(?\s*(?:[123]\s?)?'+ABBR+r'\.?\s+\d+(?::\d+(?:[-–,]\s?\d+)*)?(?:\s*;\s*(?:[123]\s?)?'+ABBR+r'?\.?\s*\d+(?::\d+(?:[-–,]\d+)*)?)*\)?(?=[\s.,;:!?)]|$)')
def strip_refs(t):
    t=re.sub(r'\s*,?\s*\(?\s*⟦[^⟧]*⟧(?:\s*[;,]\s*⟦[^⟧]*⟧)*\s*\)?','',t)
    t=REFPAT.sub('',t)
    t=re.sub(r'\(\s*\)','',t)
    t=re.sub(r'\s+([,.;:!?])',r'\1',t)
    t=re.sub(r',([.;:!?])',r'\1',t)
    t=re.sub(r'\s{2,}',' ',t)
    return t.strip()
def sentences(text):
    text=re.sub(r'^-+\s*','',text.strip())
    text=text.replace('\n\n',' ')
    # protect enumerations '1. ' and abbreviations
    text=re.sub(r'\b(ch|chap|ver|viz|i\.e|e\.g|ver|St|Mr|Dr|vs|comp)\.',lambda m:m.group(1)+'∯',text)
    parts=re.split(r'(?<=[.!?])\s+(?=["“‘\'(]?[A-Z0-9])',text)
    out=[]
    for p in parts:
        p=p.replace('∯','.').strip()
        if not p: continue
        if out and (re.fullmatch(r'\d+\.',out[-1]) or (len(p.split())<2 and not re.fullmatch(r'\d+\.',p))):
            out[-1]=out[-1]+' '+p
        else: out.append(p)
    # merge enumeration markers '1.' at end of previous
    res=[]
    for p in out:
        if res and re.search(r'\b(unless|and|the|of|to|that|if|a|but|or|as|with|by|for|in)\.$',res[-1],re.I):
            res[-1]=res[-1][:-1]+' '+p
        else: res.append(p)
    return res
DEV=set(stem(w) for w in 'we us our believer believers soul souls saints grace comfort christ faith trust love mercy promise promises heart hearts pray prayer'.split())
BADSTART=re.compile(r'^(This|These|Such|That|Those|It|They|He|And|But|Here|Thus|Hence|So|Also|Or|Nor|There|Then|Yet|Them)\b')
def ngram_copy_ratio(a,b,n=4):
    A=[w.lower() for w in re.findall(r"[A-Za-z]+",a)]
    B=[w.lower() for w in re.findall(r"[A-Za-z]+",b)]
    if len(A)<n: return 0.0
    gb=set(tuple(B[i:i+n]) for i in range(len(B)-n+1))
    ga=[tuple(A[i:i+n]) for i in range(len(A)-n+1)]
    hit=[False]*len(A)
    for i,g in enumerate(ga):
        if g in gb:
            for j in range(i,i+n): hit[j]=True
    return sum(hit)/len(A)
def pick(book,ch,vs,ve,web_text):
    sb=sword_book(book)
    ps=[p for p in passages(sb,ch) if not (p[1]<vs or p[0]>ve)]
    if not ps: return None
    # choose passage with most overlap; if range spans passages, consider all (concatenate)
    a=ps[0][0]; b=ps[-1][1]
    sents=[];est=[];exact=[]
    for p in ps:
        ss=[strip_refs(x) for x in sentences(p[2])]
        ss=[x for x in ss if x and len(x.split())>=3]
        K=len(ss)
        marks=[]
        for k,x in enumerate(ss):
            m=re.match(r'^(\d+)\.\s',x)
            if m: marks.append((k,int(m.group(1))))
        nums=[n for _,n in marks]
        good=marks and all(p[0]<n<=p[1] for n in nums) and nums==sorted(nums) and len(set(nums))==len(nums)
        cur=p[0]
        mk=dict(marks) if good else {}
        for k,x in enumerate(ss):
            if good:
                if k in mk: cur=mk[k]
                e=cur+0.5
            else:
                e=p[0]+(k+0.5)/max(K,1)*(p[1]-p[0]+1)
            if good or True:
                x=re.sub(r'^\d+\.\s+','',x)
            sents.append(x); est.append(e); exact.append(bool(good))
    if not sents: return None
    verse_toks={}
    for v in range(a,b+1):
        verse_toks[v]=set(toks(KJV.get(f'{sb}|{ch}|{v}','')))
    tgt=set()
    for v in range(vs,ve+1):
        tgt|=verse_toks.get(v,set())
    tgt|=set(toks(web_text))
    df={}
    for v,s in verse_toks.items():
        for w in s: df[w]=df.get(w,0)+1
    nv=b-a+1
    kjv_target=' '.join(KJV.get(f'{sb}|{ch}|{v}','') for v in range(vs,ve+1))
    sc=[];lens=[];anch=[]
    KT=[w.lower() for w in re.findall(r"[A-Za-z]+",kjv_target)]
    KG=set(tuple(KT[i:i+3]) for i in range(len(KT)-2))
    KG={g for g in KG if sum(1 for w in g if w not in STOP)>=1}
    for s in sents:
        A=[w.lower() for w in re.findall(r"[A-Za-z]+",s)]
        hits=sum(1 for i in range(len(A)-2) if tuple(A[i:i+3]) in KG)
        anch.append(hits)
        st=toks(s)
        score=0.0
        for w in set(st):
            if w in tgt: score+=1.0/df.get(w,1)**0.7 if w in df else 0.6
            elif w in df: score-=0.25/df[w]
        if set(st)&DEV: score+=0.3
        if anch[len(sc)]: score+=1.5+min(anch[len(sc)],4)*0.3
        sc.append(score); lens.append(len(s.split()))
    N=len(sents)
    ft=((vs+ve)/2-a+0.5)/nv
    best=None
    for i in range(N):
        W=0
        for j in range(i,min(N,i+8)):
            W+=lens[j]
            k=j-i+1
            if W>125 and k>1: break
            ec=(est[i]+est[j])/2
            s=sum(max(x,-0.5) for x in sc[i:j+1])
            d=0 if vs<=ec<=ve+1 else min(abs(ec-vs),abs(ec-ve-1))
            d=d/nv
            d+=0.4*max(0,est[i]-ve-0.5)/nv+0.7*max(0,est[i]-vs-0.5)/nv
            s-= 12.0*d*(1 if nv>1 else 0)
            if any(anch) and not any(anch[i:j+1]): s-=2.5
            s-=sum(1.5 for q in range(i,j+1) if exact[q] and (est[q]<vs or est[q]>ve+1))*8/3
            if anch[i]: s+=0.6
            elif i+1<=j and anch[i+1]: s+=0.3
            if W<40: s-=(40-W)*0.08
            if W>110: s-=(W-110)*0.06
            if k<2 and W<60: s-=0.8
            if k>5 and W>80: s-=(k-5)*0.6
            if BADSTART.match(sents[i]) and i>0: s-=0.7
            seg=' '.join(sents[i:j+1])
            cr=max(ngram_copy_ratio(seg,kjv_target),ngram_copy_ratio(seg,web_text))
            if cr>0.45: s-=5
            if best is None or s>best[0]: best=(s,i,j,W,cr)
    s,i,j,W,cr=best
    seg=' '.join(sents[i:j+1])
    seg=re.sub(r'\s+\d+\.$','',seg)
    seg=re.sub(r'(?<=[\s,;:])\d+\.\s+(?=[A-Z])','',seg)
    seg=re.sub(r'\s{2,}',' ',seg).strip()
    out=modernize(seg)
    out=re.sub(r'\bFear you not\b','Fear not',out)
    out=out.replace(' ,',',')
    out=re.sub(r'^[^\n]*?\s--(?=[A-Z])','',out).strip()
    out=re.sub(r'\bhalteth\b','halts',out)
    out=re.sub(r'\s*--\s*','—',out)
    return {'text':out,'words':len(out.split()),'copy':round(cr,3),'passage':[a,b],'sent':[i,j,N],'overlap':round(sum(sc[i:j+1]),2)}
if __name__=='__main__':
    P=json.load(open('/workspace/gods-promises/promises.json'))['promises']
    import sys
    want=sys.argv[1:]
    for p in P:
        if p['id'] in want:
            r=pick(p['book'],p['chapter'],p['verseStart'],p['verseEnd'],p['text'])
            print(p['reference'],'|',p['text']);print('  OLD:',p['promise']);print('  NEW:',r);print()
