import test from 'node:test';
import assert from 'node:assert/strict';
import {hubAllows} from '../src/lib/hub';

test('the shared ingest address accepts telemetry and nothing else', () => {
  assert.equal(hubAllows('POST', '/api/ingest'), true);
  assert.equal(hubAllows('GET', '/api/ingest'), false);
  assert.equal(hubAllows('POST', '/api/nodes/egg/control'), false);
  assert.equal(hubAllows('PATCH', '/api/nodes/egg'), false);
  assert.equal(hubAllows('GET', '/api/overview'), false);
  assert.equal(hubAllows('POST', '/api/ingest/extra'), false);
});
