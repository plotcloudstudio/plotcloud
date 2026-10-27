"""Read-only production check for the owner's public weather function; no credentials."""
import gzip,io,json,math,urllib.parse,urllib.request,zipfile,hashlib
from pathlib import Path
ENDPOINT='https://cgxszynizkbiblfiaowf.supabase.co/functions/v1/quick-function'
ORIGINS={'onebuilding':'https://climate.onebuilding.org','doe':'https://energyplus-weather.s3.amazonaws.com'}
def get(url):
 try:
  response=urllib.request.urlopen(urllib.request.Request(url,headers={'Origin':'https://plotcloudstudio.github.io'}),timeout=55)
 except urllib.error.HTTPError as error:
  raise RuntimeError('Weather function HTTP '+str(error.code)+': '+error.read(1000).decode(errors='replace')) from error
 assert response.headers.get('Access-Control-Allow-Origin')=='*','Public weather CORS header is missing'
 return response.read(25*1024*1024+1)
health=json.loads(get(ENDPOINT+'?health=1'));assert health.get('service')=='plotcloud-weather' and health.get('ready') is True
print('PASS deployed function health and public CORS; no authentication sent',flush=True)
rows=json.loads(gzip.decompress(Path('mvp/data/epw-stations.json.gz').read_bytes()))['stations']
def distance(a,b):
 r=math.pi/180;h=math.sin((b[0]-a[0])*r/2)**2+math.cos(a[0]*r)*math.cos(b[0]*r)*math.sin((b[1]-a[1])*r/2)**2
 return 12742*math.asin(math.sqrt(min(1,h)))
report={'health':health,'stations':[]}
for name,point in [('Vancouver',(49.2827,-123.1207)),('Toronto',(43.6532,-79.3832))]:
 station=min(rows,key=lambda s:(distance(point,(s[2],s[3])),s[5]!='onebuilding'))
 url=ORIGINS[station[5]]+station[4];archive=get(ENDPOINT+'?'+urllib.parse.urlencode({'url':url}));assert len(archive)<=25*1024*1024
 with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
  members=[m for m in zipped.infolist() if m.filename.lower().endswith('.epw')];assert len(members)==1
  member=members[0];assert member.file_size<=8*1024*1024;text=zipped.read(member).decode('utf-8-sig');lines=text.strip().splitlines();head=lines[0].split(',');assert head[0]=='LOCATION';assert len(lines)-8 in [8760,8784]
  for line in lines[8:]:
   data=line.split(',');assert len(data)>=22
   assert all(data[i].strip() and math.isfinite(float(data[i])) for i in [6,20,21]);assert float(data[6])<99 and float(data[20])<999 and 0<=float(data[21])<999
  assert distance((station[2],station[3]),(float(head[6]),float(head[7])))<=25
  actual={'city':name,'catalogStation':station[1],'epwStation':head[1],'hours':len(lines)-8,'archiveBytes':len(archive),'sourceURL':url,'sha256':hashlib.sha256(text.encode()).hexdigest()};report['stations'].append(actual);print('PASS real '+name+' ZIP and full-year EPW: '+json.dumps(actual),flush=True)
Path('/tmp/plotcloud-weather-live.json').write_text(json.dumps(report,indent=2))
