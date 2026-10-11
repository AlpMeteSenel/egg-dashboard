import {chmodSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {HUB_PORT, ingestUrls} from '../src/lib/hub';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nodeId = process.argv[2] || '';
if (!/^[A-Za-z0-9_-]{1,64}$/.test(nodeId)) {
  console.error('Usage: npm run node:config -- <node-id>');
  process.exit(1);
}
const saved = JSON.parse(readFileSync(join(root, '.data/node-client.json'), 'utf8')) as {token?: string; interval?: number};
if (!saved.token) throw new Error('The local node credential is missing.');
const endpoint = process.argv[3] || ingestUrls()[0] || `http://127.0.0.1:${HUB_PORT}/api/ingest`;
const config = {
  node_id: nodeId,
  token: saved.token,
  endpoint,
  local_state: 'http://127.0.0.1:8091/api/state',
  local_config: 'http://127.0.0.1:8091/api/config',
  interval: saved.interval || 1,
};
const path = join(root, '.data/nodes', nodeId + '.json');
mkdirSync(dirname(path), {recursive: true});
writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
chmodSync(path, 0o600);
console.log(`Prepared ${nodeId}`);
console.log(endpoint);
console.log(`Config: .data/nodes/${nodeId}.json`);
console.log('Copy that file to the board and run: python3 publisher.py --config <file>');
console.log('The board keeps its own queue and continues locally when this computer is unreachable.');
