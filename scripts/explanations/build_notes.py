import json,re,html,os,collections
P=json.load(open('/workspace/gods-promises/promises.json'))['promises']
RB=json.load(open('/workspace/hb/raw_barnes.json')); RJ=json.load(open('/workspace/hb/raw_jfb.json'))
from select_henry import sword_book
OTB=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi']
BOT={'Job','Psalms','Isaiah','Daniel'}
GH=r'\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF\uFB1D-\uFB4F'
def degreek(t):
    t=re.sub(r'\([^()]*['+GH+r'][^()]*\)','',t)
    t=re.sub(r'\[[^\[\]]*['+GH+r'][^\[\]]*\]','',t)
    # tokens: hebrew/greek words and transliterations (combining marks / special letters)
    tok=r"[^\s,;.:()]*(?:["+GH+r"\u0300-\u036F\u02BB\u02BC\u02BF\u02BE\u2018\u201B\u0131][^\s,;.:()]*)"
    t=re.sub(r'(?:'+tok+r'\s*)+(?=[\s,;.:)]|$)',lambda m: '' if re.search('['+GH+r'\u0300-\u036F\u0131\u201B\u02BB\u02BF\u02BE]',m.group(0)) else m.group(0),t)
    t=re.sub(r'\(\s*\)','',t); t=re.sub(r'\[\s*\]','',t)
    t=re.sub(r'\s+([,;.:])',r'\1',t); t=re.sub(r'([,;:])\s*\1',r'\1',t)
    t=re.sub(r'\s{2,}',' ',t)
    return t.strip()
def strip_tags(t):
    t=re.sub(r'<[^>]+>','',t)
    t=html.unescape(t).replace('\xa0',' ')
    return re.sub(r'[ \t\r\n]+',' ',t).strip()
def finish(paras):
    out=[]
    for l,t in paras:
        l=degreek(strip_tags(l)) if l else ''
        t=degreek(strip_tags(t))
        t=re.sub(r'^[\s\-–—:.,]+','',t)
        t=re.sub(r'\s*--\s*','—',t); l=re.sub(r'\s*--\s*','—',l)
        t=re.sub(r'\s+-\s*([.,;])',r'\1',t)
        l=l.strip(' -–—:.,')
        if not t and not l: continue
        if len(t.split())<1 and l: t=''
        out.append({'l':l,'t':t} if l else t)
    return out
def words(paras):
    return sum(len(((p['l']+' '+p['t']) if isinstance(p,dict) else p).split()) for p in paras)
# ---- biblehub
BH={}
def bh_chapter(kind,book,ch):
    key=(kind,book,ch)
    if key in BH: return BH[key]
    fn=f"/workspace/hb/cache/{kind}_{book.lower().replace(' ','_')}_{ch}.htm"
    res={}
    if os.path.exists(fn):
        t=open(fn,encoding='utf-8',errors='replace').read()
        end=t.find('<div id="botbox">'); t=t[:end] if end>0 else t
        chunks=t.split('<div class="versenum">')[1:]
        for c in chunks:
            m=re.search(r'href="/[^"/]+/(\d+)-(\d+)\.htm"',c)
            if not m: continue
            v=int(m.group(2))
            c=re.sub(r'^.*?</div>','',c,count=1,flags=re.S)
            c=re.sub(r'<div class="verse">.*?</div>','',c,count=1,flags=re.S)
            c=re.sub(r'<a [^>]*>(.*?)</a>',r'\1',c,flags=re.S)
            c=re.sub(r'^\s*[IVXLC]+\.\s*</span>','',c)
            c=c.replace('</span>','</span>',)
            ps=re.split(r'<p>|<br\s*/?>\s*<br\s*/?>',c)
            paras=[]
            for p in ps:
                p=p.strip()
                if not strip_tags(p): continue
                if kind=='ellicott':
                    p=re.sub(r'^\(\d+(?:[-–]\d+)?\)\s*','',strip_tags_keep_bld(p))
                    m2=re.match(r'^<span class=\s*"bld">(.*?)</span>\s*[—\-–]*\s*(.*)$',p,re.S)
                    if m2: paras.append((m2.group(1),m2.group(2)))
                    else: paras.append(('',p))
                else:
                    s=strip_tags(p)
                    m2=re.match(r'^(.{2,90}?) - (.*)$',s,re.S)
                    if m2 and len(m2.group(1).split())<=14: paras.append((m2.group(1),m2.group(2)))
                    else: paras.append(('',s))
            res[v]=finish(paras)
    BH[key]=res; return res
def strip_tags_keep_bld(p):
    p=re.sub(r'<span class=\s*"bld">',"\x01",p)
    p=re.sub(r'</span>',"\x02",p)
    # restore only first bld span pair; others become plain
    p=re.sub(r'<[^>]+>','',p)
    first=p.find("\x01")
    if first>=0 and p[:first].strip()=='' :
        j=p.find("\x02",first)
        p='<span class="bld">'+p[first+1:j]+'</span>'+p[j+1:]
    p=p.replace("\x01",'').replace("\x02",'')
    return p.strip()
# ---- sword
def sword_barnes(sb,ch,v):
    r=RB.get(f'{sb}|{ch}|{v}')
    if not r: return []
    r=re.sub(r'<scripRef[^>]*>(.*?)</scripRef>',r'\1',r,flags=re.S)
    ps=re.split(r'<br\s*/?>\s*<br\s*/?>|<p\s*/?>',r)
    paras=[]
    for p in ps:
        p=p.strip()
        p=re.sub(r'^Verse\s+\d+(?:[-–]\d+)?\.\s*','',p)
        m=re.match(r'^<i>(.*?)</i>\s*\.?\s*(.*)$',p,re.S)
        if m and len(strip_tags(m.group(1)).split())<=16: paras.append((m.group(1),m.group(2)))
        elif strip_tags(p): paras.append(('',p))
    return finish(paras)
def sword_jfb(sb,ch,v):
    r=RJ.get(f'{sb}|{ch}|{v}')
    if not r: return []
    r=re.sub(r'<div type="x-milestone"[^>]*/>','',r)
    r=re.sub(r'<reference[^>]*>(.*?)</reference>',r'\1',r,flags=re.S)
    ps=re.split(r'<div [^>]*type="x-p"[^>]*/>',r)
    paras=[]
    for p in ps:
        p=p.strip()
        if not strip_tags(p): continue
        m=re.match(r'^<hi type="bold">(.*?)</hi>\s*(.*)$',p,re.S)
        if m:
            l=re.sub(r'^\s*\d+(?:[-–,]\d+)*\.\s*','',strip_tags(m.group(1))).rstrip('-— ')
            paras.append((l,m.group(2)))
        else: paras.append(('',p))
    return finish(paras)
def gather(fn,ve_list,ch,vs):
    """collect notes for vs..ve; if first verse empty, walk back to a covering range block"""
    out=[];seen=set();got=False
    for v in ve_list:
        ps=fn(ch,v)
        key=json.dumps(ps)
        if ps and key not in seen:
            seen.add(key); out.append((v,ps)); got=True
    if not out or out[0][0]!=vs:
        for back in range(1,6):
            if vs-back<1: break
            ps=fn(ch,vs-back)
            if ps:
                # accept only if JSON not already and note likely covers (heuristic: range-lemma or last verse before)
                key=json.dumps(ps)
                if key not in seen: out.insert(0,(vs-back,ps))
                break
    return out
def flatten(blocks,multi):
    res=[]
    for v,ps in blocks:
        if multi: res.append({'v':v})
        res.extend(ps)
    return res
notes=collections.defaultdict(dict); stats=collections.Counter(); weak=[]
for p in P:
    b=p['book']; ch=p['chapter']; vs=p['verseStart']; ve=p['verseEnd'] or vs
    sb=sword_book(b); vl=list(range(vs,ve+1))
    cands=[]
    if b not in OTB:
        cands.append(("Barnes' Notes",gather(lambda c,v:sword_barnes(sb,c,v),vl,ch,vs)))
    elif b in BOT:
        cands.append(("Barnes' Notes",gather(lambda c,v:bh_chapter('barnes',b,c).get(v,[]),vl,ch,vs)))
    else:
        cands.append(("Ellicott's Commentary",gather(lambda c,v:bh_chapter('ellicott',b,c).get(v,[]),vl,ch,vs)))
    jfb=("Jamieson-Fausset-Brown",gather(lambda c,v:sword_jfb(sb,c,v),vl,ch,vs))
    src,blocks=cands[0]
    W=sum(words(ps) for _,ps in blocks)
    if b in OTB and b not in BOT:
        Wj=sum(words(ps) for _,ps in jfb[1])
        if Wj>W: src,blocks,W=jfb[0],jfb[1],Wj
    elif W<15:
        Wj=sum(words(ps) for _,ps in jfb[1])
        if Wj>W: src,blocks,W=jfb[0],jfb[1],Wj
    if W==0:
        weak.append((p['id'],src,W)); stats['none']+=1; continue
    multi=len(blocks)>1
    slug=b.lower().replace(' ','-')
    notes[slug][p['id']]={'src':src,'paras':flatten(blocks,multi)}
    stats[src]+=1
    if W<40: weak.append((p['id'],src,W))
os.makedirs('/workspace/gods-promises/data/notes',exist_ok=True)
tot=0
for slug,d in notes.items():
    s=json.dumps(d,ensure_ascii=False,separators=(',',':'))
    open(f'/workspace/gods-promises/data/notes/{slug}.json','w').write(s); tot+=len(s)
print(dict(stats),'total bytes',tot,'books',len(notes))
print('weak',len(weak),weak[:40])
json.dump({'stats':dict(stats),'weak':weak},open('/workspace/hb/notes_report.json','w'))
