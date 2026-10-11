import {networkInterfaces} from 'node:os';

export const HUB_PORT = 3080;

export function hubAllows(method: string, pathname: string) {
  return method === 'POST' && pathname === '/api/ingest';
}

export function lanAddresses() {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

export function ingestUrls(port = HUB_PORT) {
  return lanAddresses().map(address => `http://${address}:${port}/api/ingest`);
}
