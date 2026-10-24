import re,json,collections
_freq=None
def freq():
    global _freq
    if _freq is None:
        c=collections.Counter()
        for f in ['raw_mhcc.json','raw_barnes.json','raw_jfb.json']:
            seen=set()
            for v in json.load(open('/workspace/hb/'+f)).values():
                if v in seen: continue
                seen.add(v)
                c.update(w.lower() for w in re.findall(r"[A-Za-z]+",re.sub(r'<[^>]+>',' ',v)))
        _freq=c
    return _freq
EXC_ETH=set('''beth seth teeth heth gath japheth nazareth elizabeth beneath breath death faith saith hath doth
teth meth bekah lilith kenneth macbeth tybeth shibboleth ahimelech jetheth jetheth jether eth hazeroth
ashtoreth ashtaroth moreth goliath shebeth tebeth bethbeth elisabeth gareth seventh eleventh tenth twentieth
thirtieth fortieth fiftieth sixtieth hundredth thousandth fifteenth sixteenth seventeenth eighteenth nineteenth
fourteenth thirteenth twelfth eth'''.split())
def third_person(stem):
    f=freq()
    cands=[]
    if stem.endswith('i'): cands.append(stem[:-1]+'ies')
    cands += [stem+'s', stem+'es']
    if len(stem)>2 and stem[-1]==stem[-2] and stem[-1] not in 'slz': cands.append(stem[:-1]+'s')
    best=max(cands,key=lambda w:f.get(w,0))
    if f.get(best,0)==0: return None
    return best
def base_form(stem):
    f=freq()
    cands=[stem, stem+'e']
    if len(stem)>2 and stem[-1]==stem[-2]: cands.append(stem[:-1])
    if stem.endswith('i'): cands.append(stem[:-1]+'y')
    best=max(cands,key=lambda w:f.get(w,0))
    return best if f.get(best,0)>0 else None
def keepcase(src,dst):
    if src.isupper() and len(src)>1: return dst.upper()
    if src[0].isupper(): return dst[0].upper()+dst[1:]
    return dst
SIMPLE={'thee':'you','thou':'you','thy':'your','thyself':'yourself','ye':'you','hath':'has','doth':'does',
 'saith':'says','hast':'have','shalt':'shall','wilt':'will','canst':'can','dost':'do','didst':'did',
 'wast':'were','couldst':'could','wouldst':'would','shouldst':'should','mayest':'may','mightest':'might',
 'unto':'to','shew':'show','shews':'shows','shewed':'showed','shewn':'shown','shewing':'showing',
 'spake':'spoke','stedfast':'steadfast','stedfastly':'steadfastly','stedfastness':'steadfastness',
 'chuse':'choose','chusing':'choosing','connexion':'connection','connexions':'connections','burthen':'burden',
 'burthens':'burdens','burthened':'burdened','ancle':'ankle','gaol':'jail','phrenzy':'frenzy','divers':'various',
 'whilst':'while','betwixt':'between','amongst':'among','oftentimes':'often','wherefore':'therefore',
 'hinderances':'hindrances','hinderance':'hindrance','shouldest':'should','wouldest':'would','couldest':'could',
 'knowest':'know','seest':'see','art':None,'thine':None,'every thing':None}
def modernize(t):
    log=[]
    def rep(m):
        w=m.group(0); lw=w.lower()
        if lw in SIMPLE and SIMPLE[lw]:
            return keepcase(w,SIMPLE[lw])
        return w
    # thou art / art thou
    t=re.sub(r'\b([Tt])hou art\b',lambda m:('Y' if m.group(1)=='T' else 'y')+'ou are',t)
    t=re.sub(r'\b([Aa])rt thou\b',lambda m:('A' if m.group(1)=='A' else 'a')+'re you',t)
    t=re.sub(r'\b([Aa])rt\b(?=\s+(?:not\s+)?(?:you|thou)\b)',lambda m:m.group(1)+'re',t)
    # thine + vowel -> your; else yours
    t=re.sub(r'\b([Tt])hine(?=\s+[aeiouhAEIOUH])',lambda m:('Y' if m.group(1)=='T' else 'y')+'our',t)
    t=re.sub(r'\b([Tt])hine\b',lambda m:('Y' if m.group(1)=='T' else 'y')+'ours',t)
    # thou Xest -> you X
    def thou_est(m):
        pre,verb=m.group(1),m.group(2)
        lv=verb.lower()
        if lv in SIMPLE and SIMPLE[lv]: return pre+keepcase(verb,SIMPLE[lv])
        stem=lv[:-3] if lv.endswith('est') else lv[:-2]
        b=base_form(stem)
        return pre+(keepcase(verb,b) if b else verb)
    t=re.sub(r'\b((?:[Tt]hou|[Yy]ou)\s+(?:not\s+)?)([a-z]+e?st)\b',lambda m: thou_est(m) if m.group(2).lower() not in ('first','best','just','most','least','must','almost','last','rest','lest','against') else m.group(0),t)
    t=re.sub(r"\b[A-Za-z]+\b",rep,t)
    # -eth verbs
    def eth(m):
        w=m.group(0); lw=w.lower()
        if lw in EXC_ETH or len(lw)<5 or lw.endswith('th') and not lw.endswith('eth'): return w
        stem=lw[:-3]
        tp=third_person(stem)
        if not tp: return w
        return keepcase(w,tp)
    t=re.sub(r'\b[A-Za-z]{2,}eth\b',eth,t)
    t=re.sub(r'\bevery thing\b','everything',t); t=re.sub(r'\bEvery thing\b','Everything',t)
    t=re.sub(r'\bany thing\b','anything',t); t=re.sub(r'\bAny thing\b','Anything',t)
    t=re.sub(r'\bevery one\b','everyone',t)
    return t
if __name__=='__main__':
    for s in ["Fear thou not, for I am with thee: Art thou weak? I will strengthen thee. Thou knowest thy heart; he loveth and giveth, he causeth it and blesseth; he that believeth hath life. Thou art mine; thine eyes. Thou lovest; he cometh, goeth, seeth, crieth, castest, maketh, abideth, hopeth, useth, changeth, Nazareth, beneath, teeth, death, shew. Lift up thine head."]:
        print(modernize(s))
