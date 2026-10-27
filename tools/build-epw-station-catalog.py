"""Rebuild station metadata from the pinned public EPWMap bundle, not weather files.
Download https://raw.githubusercontent.com/ladybug-tools/epwmap/86e0b24673c88c700a664f4cad5d735e7a91704b/static/js/main.9fb25122.js
then run: python tools/build-epw-station-catalog.py /path/to/main.9fb25122.js
"""
import json,re,gzip,hashlib,sys
from pathlib import Path
bundle=Path(sys.argv[1]).read_text();rows=[]
for m in re.finditer(r'\[("(?:[^"\\]|\\.)*"(?:,"(?:[^"\\]|\\.)*"){6})\]',bundle):
 try:row=json.loads('['+m[1].replace("\\'","'")+']')
 except ValueError:continue
 if row[-1] in ['doe','onebuilding']:rows.append(row)
if len(rows)<50000:raise ValueError('Unexpected EPWMap metadata layout; inspect before updating the catalog.')
best={}
for ident,name,dataset,lat,lon,path,provider in rows:
 if not path.endswith('.zip'):continue
 period=re.search(r'TMYx\.(\d{4}-\d{4})',path);period=period[1] if period else dataset
 score=(int(period[-4:]) if re.fullmatch(r'\d{4}-\d{4}',period) else 0,'TMYx' in path)
 key=(ident,provider)
 if key not in best or score>best[key][0]:best[key]=(score,[ident,name,float(lat),float(lon),path,provider,period])
entries=[v[1] for v in best.values()];entries.sort(key=lambda r:(r[5],r[0],r[1]));data={'schema':1,'retrieved':'2026-10-27','source':'https://github.com/ladybug-tools/epwmap/tree/86e0b24673c88c700a664f4cad5d735e7a91704b','sourcePublished':'2023-10-20','sourceCommit':'86e0b24673c88c700a664f4cad5d735e7a91704b','sourceSHA256':hashlib.sha256(bundle.encode()).hexdigest(),'note':'Station metadata from EPWMap. The catalog is a snapshot, not a guarantee of latest weather releases. Weather archives remain with their publishers.','stations':entries}
b=json.dumps(data,separators=(',',':'),ensure_ascii=False).encode();Path('mvp/data/epw-stations.json.gz').write_bytes(gzip.compress(b,mtime=0));print({'stations':len(entries),'bytes':len(b),'compressed':Path('mvp/data/epw-stations.json.gz').stat().st_size})
