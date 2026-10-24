import json,re,html
from pysword.canons import canons
K=canons['kjv']
VC={}
for t in ('ot','nt'):
    for bk in K[t]: VC[bk[0]]=bk[3]
RAW=json.load(open('/workspace/hb/raw_mhcc.json'))
HDR=re.compile(r'<hi type="bold">\s*Verses?\s+([\d][\d\s,\-–]*)\s*</hi>')
def clean_inline(s):
    s=re.sub(r'<title[^>]*>.*?</title>',' ',s,flags=re.S)
    s=re.sub(r'<table>.*?</table>',' ',s,flags=re.S)
    s=re.sub(r'<div [^>]*type="x-p"[^>]*/>','\n\n',s)
    s=re.sub(r'<reference[^>]*>(.*?)</reference>',r'⟦\1⟧',s,flags=re.S)
    s=re.sub(r'<[^>]+>',' ',s)
    s=html.unescape(s)
    s=re.sub(r'[ \t]+',' ',s)
    return s
def parse_range(r,start_default):
    nums=[int(x) for x in re.findall(r'\d+',r)]
    if not nums: return start_default,start_default
    return nums[0],nums[-1] if len(nums)>1 else nums[0]
_cache={}
def passages(book,ch):
    key=(book,ch)
    if key in _cache: return _cache[key]
    n=VC[book][ch-1]
    blocks=[];last=None
    for v in range(1,n+1):
        s=RAW.get(f'{book}|{ch}|{v}')
        if s and s!=last:
            blocks.append((v,s)); last=s
    out=[]
    for v,s in blocks:
        parts=HDR.split(s)
        if len(parts)==1:
            txt=clean_inline(s)
            paras=[p.strip() for p in txt.split('\n\n') if p.strip()]
            # drop short leading summary paragraphs
            while len(paras)>1 and (len(paras[0].split())<15 or paras[0].count('⟦')>=2):
                paras.pop(0)
            out.append([v,None,'\n\n'.join(paras)])
        else:
            for i in range(1,len(parts),2):
                a,b=parse_range(parts[i],v)
                txt=clean_inline(parts[i+1])
                paras=[p.strip() for p in txt.split('\n\n') if p.strip()]
                out.append([a,b,'\n\n'.join(paras)])
    out.sort(key=lambda x:x[0])
    for i,p in enumerate(out):
        nxt=(out[i+1][0]-1) if i+1<len(out) else n
        p[1]=max(p[1] or 0,nxt) if (p[1] is None or p[1]<nxt) else min(p[1],nxt) if nxt>=p[0] else p[1]
    _cache[key]=out
    return out
if __name__=='__main__':
    import sys
    for ref in sys.argv[1:]:
        b,c=ref.rsplit(' ',1); 
        for p in passages(b,int(c)): print(p[0],p[1],p[2][:300].replace('\n','¶'));
        print('---')
