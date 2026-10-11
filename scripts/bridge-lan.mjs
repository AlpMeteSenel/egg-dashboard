import {chmodSync, readFileSync, writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const address = process.argv[2] || '192.168.1.194';
if (!/^[a-zA-Z0-9.-]+$/.test(address)) throw new Error('Use the board hostname or IP address.');

const saved = JSON.parse(readFileSync(join(root, '.data/node-client.json'), 'utf8'));
const config = {
  node_id: saved.node_id,
  token: saved.token,
  endpoint: 'http://127.0.0.1:3000/api/ingest',
  local_state: `http://${address}:8091/api/state`,
  local_config: `http://${address}:8091/api/config`,
  interval: saved.interval || 1,
};
const configPath = join(root, '.data/lan-bridge.json');
writeFileSync(configPath, JSON.stringify(config));
chmodSync(configPath, 0o600);

const child = spawn('python3', ['-u', join(root, 'node/publisher.py'), '--config', configPath], {cwd: root, stdio: 'inherit'});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
