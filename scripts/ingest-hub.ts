import http from 'node:http';
import {HUB_PORT, hubAllows, ingestUrls, lanAddresses} from '../src/lib/hub';

const upstream = process.env.SWARMFLOW_UPSTREAM || 'http://127.0.0.1:3000';
const port = Number(process.env.SWARMFLOW_HUB_PORT || HUB_PORT);
const maxBytes = 1_500_000;

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  if (!hubAllows(req.method || '', pathname)) {
    res.writeHead(404, {'content-type': 'application/json', 'cache-control': 'no-store'});
    res.end(JSON.stringify({error: 'This address only accepts module telemetry.'}));
    return;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let rejected = false;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > maxBytes && !rejected) {
      rejected = true;
      res.writeHead(413, {'content-type': 'application/json', 'cache-control': 'no-store'});
      res.end(JSON.stringify({error: 'Request too large.'}));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (rejected) return;
    const headers: Record<string, string> = {'content-type': req.headers['content-type'] || 'application/json'};
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    fetch(upstream + '/api/ingest', {method: 'POST', headers, body: Buffer.concat(chunks)}).then(async response => {
      const text = await response.text();
      if (res.writableEnded) return;
      res.writeHead(response.status, {'content-type': response.headers.get('content-type') || 'application/json', 'cache-control': 'no-store'});
      res.end(text);
    }).catch(() => {
      if (res.writableEnded) return;
      res.writeHead(502, {'content-type': 'application/json', 'cache-control': 'no-store'});
      res.end(JSON.stringify({error: 'Dashboard ingest is not reachable.'}));
    });
  });
});

server.listen(port, '0.0.0.0', () => {
  const urls = ingestUrls(port);
  console.log('SWARMFLOW ingest hub listening.');
  console.log(urls.length ? urls.join('\n') : `http://${lanAddresses()[0] || '0.0.0.0'}:${port}/api/ingest`);
  console.log('Only POST /api/ingest is forwarded. Dashboard controls stay on localhost:3000.');
});
