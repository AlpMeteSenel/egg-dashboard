"""Import public stop metadata only from BusTO's cached MaTO export."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=Path.home()/'Projects/BusTO/tracker/data/mato_static');a=p.parse_args()
routes={r['gtfsId']:r for r in json.loads((a.source/'mato_routes.json').read_text()) if r.get('mode') in ('BUS','TRAM')}
out=[]
for s in json.loads((a.source/'mato_stops.json').read_text()):
 served=[routes[r] for r in s.get('routes',[]) if r in routes]
 if not str(s.get('gtfsId','')).startswith('gtt:') or not served or not 7.3<=s['lon']<=8.1 or not 44.7<=s['lat']<=45.5:continue
 out.append({'id':s['gtfsId'],'code':s.get('code') or s['gtfsId'].split(':')[-1],'name':s['name'],'lng':s['lon'],'lat':s['lat'],'lines':sorted(set(r['shortName'] for r in served)),'modes':sorted(set(r['mode'] for r in served))})
meta=json.loads((a.source/'mato_export_summary.json').read_text())
target=Path(__file__).resolve().parents[1]/'data/turin-stops.json'
target.write_text(json.dumps({'source':meta['source'],'as_of':meta['generated_at_utc'],'stops':sorted(out,key=lambda x:x['id'])},ensure_ascii=False,separators=(',',':')))
print(f'Imported {len(out)} GTT bus/tram stop points; snapshot {meta["generated_at_utc"]}; {target.stat().st_size} bytes')
