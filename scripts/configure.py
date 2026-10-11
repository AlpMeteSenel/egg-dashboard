from pathlib import Path
import getpass,secrets,json,os
root=Path(__file__).resolve().parents[1]
token=getpass.getpass('Mapbox public token (input hidden): ')
if not token.startswith('pk.') or '\n' in token:raise SystemExit('Use a Mapbox public token.')
existing=root/'.env.local'
secret=next((line.partition('=')[2] for line in existing.read_text().splitlines() if line.startswith('NODE_INGEST_SECRET=')),secrets.token_urlsafe(36)) if existing.exists() else secrets.token_urlsafe(36)
env=root/'.env.local';env.write_text('NEXT_PUBLIC_MAPBOX_TOKEN='+token+'\nNODE_INGEST_SECRET='+secret+'\n');env.chmod(0o600)
p=root/'.data/node-client.json';p.parent.mkdir(exist_ok=True);p.write_text(json.dumps({'node_id':'egg','endpoint':'http://127.0.0.1:18080/api/ingest','token':secret,'local_state':'http://127.0.0.1:8091/api/state','local_config':'http://127.0.0.1:8091/api/config','interval':1}));p.chmod(0o600)
print('Dashboard and node credentials configured in ignored local files.')
