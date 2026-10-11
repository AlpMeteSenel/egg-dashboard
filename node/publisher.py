#!/usr/bin/env python3
"""Independent telemetry publisher. No camera access, inference or MCU serial access."""
from pathlib import Path
import argparse,base64,hashlib,json,time,sqlite3,urllib.request,urllib.error

def packet_from_state(state,node_id):
 camera=state.get('camera') or {};vision=state.get('vision') or {}
 captured=camera.get('capture_ts') or time.time();source=camera.get('source_kind','unavailable')
 sample_id=str(camera.get('stream_id','none'))+':'+str(camera.get('frame_id',0))+':'+str(captured)
 bus=vision.get('bus_stop') or {}
 packet={'node_id':node_id,'sample_id':sample_id,'capture_ts':captured,'source_kind':source,'mcu_ok':bool(state.get('mcu_ok')),'fps':camera.get('fps',0),'inference_ms':camera.get('inference_ms',0),'frame_age_ms':vision.get('frame_age_ms') or 0,'sensors':state.get('sensors') or {},'vision':{key:vision.get(key) for key in ('camera_mode','auto_led','occupied','crossing_status','tracks','counts','directions','events','profile','command_latency_ms','led_command','traffic','cfg','cfg_hash','traffic_lights','countdown')}}
 packet['vision']['bus_stop']={key:bus.get(key) for key in ('count','threshold','threshold_reached','status','warnings')}
 return packet,camera.get('frame') if source=='live' else None

def compact_preview(preview):
 """Preserve the full view and normalized geometry; reduce only transport JPEG size."""
 if not isinstance(preview,str) or not preview:return None
 try:
  import cv2,numpy as np
  cv2.setNumThreads(1)
  image=cv2.imdecode(np.frombuffer(base64.b64decode(preview),dtype=np.uint8),cv2.IMREAD_COLOR)
  if image is None:return None
  height,width=image.shape[:2]
  if width>512:image=cv2.resize(image,(512,round(height*512/width)),interpolation=cv2.INTER_AREA)
  ok,jpg=cv2.imencode('.jpg',image,[cv2.IMWRITE_JPEG_QUALITY,68])
  return base64.b64encode(jpg).decode() if ok else None
 except Exception:
  # A machine without OpenCV still forwards the untouched full-frame JPEG.
  if len(preview)>850000:return None
  try:raw=base64.b64decode(preview,validate=True)
  except Exception:return None
  return preview if len(raw)>2 and raw[0]==255 and raw[1]==216 else None

class Outbox:
 def __init__(self,path):
  self.db=sqlite3.connect(path);self.db.execute('PRAGMA journal_mode=WAL');self.db.execute('CREATE TABLE IF NOT EXISTS queue(id TEXT PRIMARY KEY,body TEXT,at REAL)');self.db.execute('CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY,body TEXT)');self.db.commit()
 def put(self,p):
  self.db.execute('INSERT OR IGNORE INTO queue VALUES(?,?,?)',(p['sample_id'],json.dumps(p),time.time()));self.db.execute('DELETE FROM queue WHERE id IN (SELECT id FROM queue ORDER BY at DESC LIMIT -1 OFFSET 5000)');self.db.commit()
 def pending(self):return [(i,json.loads(body)) for i,body in self.db.execute('SELECT id,body FROM queue ORDER BY at LIMIT 25')]
 def remove(self,i):self.db.execute('DELETE FROM queue WHERE id=?',(i,));self.db.commit()
 def count(self):return self.db.execute('SELECT COUNT(*) FROM queue').fetchone()[0]
 def results(self):return [json.loads(body) for body, in self.db.execute('SELECT body FROM results')]
 def acknowledged_results(self,results):
  for r in results:self.db.execute('DELETE FROM results WHERE id=?',(r['id'],))
  self.db.commit()
 def done(self,command_id,result):
  self.db.execute('INSERT OR REPLACE INTO results VALUES(?,?)',(command_id,json.dumps(result)));self.db.commit()

def request(url,data=None,token=None,timeout=8):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(url,data=json.dumps(data).encode() if data is not None else None,headers=headers)
 with urllib.request.urlopen(req,timeout=timeout) as response:return json.load(response)

def run(config):
 root=Path(__file__).resolve().parent;outbox=Outbox(root/'outbox.sqlite');last_status=0;last_good=None;last_error=None
 print('SWARMFLOW publisher running; telemetry only, no inference or camera changes.',flush=True)
 while True:
  started=time.monotonic();current=None;preview=None
  try:
   current,preview=packet_from_state(request(config['local_state']),config['node_id']);outbox.put(current);preview=compact_preview(preview)
   # Publish the current view first; historical samples drain in chronological order.
   # The server keeps visual freshness separate from archived counter progress.
   live=dict(current,live_only=True,pending_samples=outbox.count(),control_results=outbox.results())
   if preview:live['preview']=preview
   answer=request(config['endpoint'],live,config['token'])
   if answer.get('ok') is not True:raise RuntimeError('Server did not acknowledge current telemetry')
   outbox.acknowledged_results(live['control_results']);last_good=time.time();last_error=None
   for command in answer.get('commands',[]):
    command_id=command.get('id');settings=command.get('config') or {}
    if not command_id or not settings or any(k not in ('camera_mode','auto_led','cfg') for k in settings):continue
    try:result=request(config.get('cfg_endpoint',config['local_config']) if set(settings)=={'cfg'} else config['local_config'],settings);ok=result.get('ok') is True;outbox.done(command_id,{'id':command_id,'ok':ok,'error':None if ok else 'Node rejected setting'})
    except Exception as e:outbox.done(command_id,{'id':command_id,'ok':False,'error':str(e)[:160]})
   pending=outbox.pending()
   if pending:
    answer=request(config['endpoint'],{'samples':[p for _,p in pending]},config['token'])
    if answer.get('ok') is not True:raise RuntimeError('Server did not acknowledge historical batch')
    acknowledged=set(answer.get('acknowledged',[]))
    for sample_id,_ in pending:
     if sample_id in acknowledged:outbox.remove(sample_id)
    last_good=time.time();last_error=None
  except Exception as e:
   # Never log credentials, packet bodies or camera images.
   last_error=type(e).__name__+'; will retry'
  if time.monotonic()-last_status>10:
   status={'node_id':config['node_id'],'last_upload':last_good,'queued_samples':outbox.count(),'error':last_error,'updated_at':time.time()};temp=root/'publisher-status.new';temp.write_text(json.dumps(status));temp.replace(root/'publisher-status.json');last_status=time.monotonic()
  time.sleep(max(.05,config.get('interval',1)-(time.monotonic()-started)))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--config',type=Path,required=True);args=parser.parse_args();run(json.loads(args.config.read_text()))
