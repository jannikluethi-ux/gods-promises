import json,time,os,urllib.request,sys
P=json.load(open('/workspace/gods-promises/promises.json'))['promises']
OT=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi']
BOT={'Job','Psalms','Isaiah','Daniel'}
jobs=set()
for p in P:
    b=p['book']
    if b not in OT: continue
    jobs.add(('barnes' if b in BOT else 'ellicott', b, p['chapter']))
jobs=sorted(jobs)
print(len(jobs),flush=True)
for c,b,ch in jobs:
    slug=b.lower().replace(' ','_')
    fn=f'cache/{c}_{slug}_{ch}.htm'
    if os.path.exists(fn) and os.path.getsize(fn)>5000: continue
    url=f'https://biblehub.com/commentaries/{c}/{slug}/{ch}.htm'
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (DailyPromises research; gentle)'})
            data=urllib.request.urlopen(req,timeout=30).read()
            open(fn,'wb').write(data); print('ok',fn,len(data),flush=True); break
        except Exception as e:
            print('err',url,e,flush=True); time.sleep(10)
    time.sleep(2.5)
print('DONE',flush=True)
