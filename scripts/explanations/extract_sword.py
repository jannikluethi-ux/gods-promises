"""Download public-domain SWORD modules from CrossWire and dump raw verse markup to JSON.
Writes /workspace/hb/raw_{mhcc,barnes,jfb}.json and kjv.json (keys 'Book|ch|v', pysword canon names).
pip install pysword
"""
import os,json,zipfile,urllib.request,glob
from pysword.modules import SwordModules  # noqa: F401 (documentation)
from pysword.bible import SwordBible
from pysword.canons import canons
OUT='/workspace/hb'; SW='/tmp/sw'
MODS={'MHCC':('ztext','OSIS'),'Barnes':('ztext','THML'),'JFB':('ztext4','OSIS'),'KJV':('ztext','OSIS')}
for m in MODS:
    d=f'{SW}/{m}'
    if not os.path.isdir(d):
        os.makedirs(d); z=f'{SW}/{m}.zip'
        urllib.request.urlretrieve(f'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/{m}.zip',z)
        zipfile.ZipFile(z).extractall(d)
    for f in glob.glob(f'{d}/modules/**/*.cz*',recursive=True):  # Barnes ships .czs/.czv/.czz
        t=f[:-4]+'.bz'+f[-1]
        if not os.path.exists(t): os.symlink(f,t)
def dump(m,clean=False):
    typ,mk=MODS[m]
    path=glob.glob(f'{SW}/{m}/modules/*/*/*/')[0]
    b=SwordBible(path,typ,'kjv','utf-8',mk)
    out={}
    for testament in ('ot','nt'):
        for bk in canons['kjv'][testament]:
            name=bk[0]
            for ch,nv in enumerate(bk[3],1):
                for v in range(1,nv+1):
                    try: t=b.get(books=[name],chapters=[ch],verses=[v],clean=clean)
                    except Exception: continue
                    if t and t.strip(): out[f'{name}|{ch}|{v}']=t
    return out
json.dump(dump('MHCC'),open(f'{OUT}/raw_mhcc.json','w'))
json.dump(dump('Barnes'),open(f'{OUT}/raw_barnes.json','w'))
json.dump(dump('JFB'),open(f'{OUT}/raw_jfb.json','w'))
json.dump(dump('KJV',clean=True),open(f'{OUT}/kjv.json','w'))
