# SWARMFLOW API Boundary — Peer Uploaders ↔ Dashboard

## LIVE CONTRACT (v2, 2026-10-11) — canonical = the dashboard repo
The real dashboard is `AlpMeteSenel/egg-dashboard` (Next.js, runs on this laptop :3000).
Canonical protocol = repo `src/lib/store.ts` + `node/publisher.py` (do not modify repo):
- `POST /api/ingest`, `Authorization: Bearer $NODE_INGEST_SECRET`, JSON ≤1.5MB.
- Live sample (1Hz): `{node_id, sample_id("stream:frame:capture_ts"), capture_ts, source_kind, mcu_ok, fps, inference_ms, frame_age_ms, sensors{}, vision{camera_mode, auto_led, occupied, crossing_status, tracks[{id,cls,conf,box,confirmed,inside,retained,speed_kmh,...}], counts(cumulative crossing counters), directions, events, profile, led_command, bus_stop{}}, preview(b64 jpg ≤900KB, live<60s), live_only:true, pending_samples, control_results[]}`.
- History batches: `{samples:[≤25 non-live_only, no preview]}` → `{acknowledged[]}`.
- Idempotency: receipts PK `(node_id, sample_id)`; duplicate → `duplicate:true` (no double tallies).
- Control: dashboard queues commands per node; the ingest RESPONSE carries `{commands:[{id,config}]}`; the publisher applies them to the node's local `/api/config` and returns `control_results` on the next sample; commands expire after 60s. Accepted config keys: `camera_mode`, `auto_led`, `cfg`.
- Camera settings UI: `PUT /api/nodes/<id>/config` (same-origin, dashboard session only) body `{"cfg":{fps 0-15, quality 5-95, size vga|qvga, zones[], led{presets{mode 0-21, brightness, for_s}, fallback, cooldown_s, rules[≤12 with sanitized when]}}}` → validated + persisted server-side and enqueued as ONE `{cfg}` command; `GET /api/nodes/<id>/config` reads it back. The peer (worker/egg) receives the full cfg, bumps its `/cfg/<node>` version, and the device applies it on its next poll (board reports `cfg_hash`/`cfg_v`).
- Track `confirmed` (≥2 observations) gates dashboard rendering, tallies and history.
- Peers: `egg` (publisher on egg → SSH tunnel :18080), `esp32cam-1` (publisher on this laptop reading worker :9010/api/state — worker exposes egg-parity schema incl. camera_mode, confirmed). Units: hackturin.service, efw.service, sf-pub-esp.service (systemd --user).
The §1-4 generic design below (central :9000 reference receiver, /cfg config-sync, LED rule engine) remains our extension; the worker's `/cfg/<node>` + LED engine + `led-intent.json` are peer-side features layered on top of this contract.


Owner: peer-side (this repo). Consumers: dashboard software (separate device/team).
Scope: **we own peer→dashboard data upload and dashboard→peer config sync**. We do not own the dashboards.
Status: v1 (2026-10-11). Reference receiver: `central.py` (:9000). Reference peers: laptop edge-worker (:9010), egg uplink daemon, ESP32-CAM node.

## 1. Data plane — peer → dashboard

### `POST {DASHBOARD}/ingest`
Content-Type: `application/json`. Body:
```json
{"device": "edge-worker", "sent_ts": 1759999000.12,
 "records": [
   {"id": 1234, "ts": 1759998995.0, "kind": "sensor", "payload": {...}},
   {"id": 1235, "ts": 1759998996.0, "kind": "flux",   "payload": {...}}
 ]}
```
- `device` — stable peer id (`edge-worker`, `egg`, …).
- `sent_ts` — ingest-side clock (float epoch s). `records[].ts` — **event time** (float epoch s). Store both; graphs use `ts`.
- `records[].id` — per-peer monotonically increasing integer (queue rowid). **Dashboard MUST dedupe on `(device, id)`** — uploaders are at-least-once (batched, WAL-backed retries).

Response: `200 {"ok":true}` on accept (rows persisted). Any other code / non-2xx → uploader keeps queue, retries with full-jitter backoff. Uploaders never drop acked data; queue is bounded (drop-oldest) and reports depth in `sensor` record.

### Record kinds and payloads (v1)
`sensor` (every ~10s per device):
```json
{"temp_c":23.5,"hum_pct":55.0,"light":4095,"pir":false,"ax":0.02,"ay":0.01,"az":1.01,
 "mcu_ok":true,"led_mode":21,"brightness_percent":18,
 "rssi":-42,"heap":101234,"fps":2.3,"sent_ok":4123,"send_fail":2,
 "cfg_hash":"ab12cd34","cfg_v":7,"queued":5}
```
(ESP32-derived sensors: rssi/heap/fps/sent_*/cfg_*; egg: temp/hum/light/pir/accel/mcu/led fields; absent fields are omitted, never zero-filled. `queued` = uploader backlog depth.)

`flux` (10s windows, GPU-processed detections):
```json
{"t0":1759998990.0,"t1":1759999000.0,"counts":{"car":3,"person":2},
 "zone":"crossing-n","source":"esp32cam-1"}
```

`occupancy` (on change, 10s heartbeat when stable):
```json
{"occupied":true,"motion_pct":4.2,"source":"esp32cam-1"}
```

`cfg` (every 30s, applied-state heartbeat — makes config-sync observable):
```json
{"node":"egg","cfg_v":12,"cfg_hash":"9f8e7d6c",
 "cfg":{"model":"ncnn-320","target_fps":5,"zones":[...ids+geom],"led_presets":3,"led_rules":5}}
```

### Presence
Device is **online** iff newest record `ts` ≤ 30s (reference: central `summary()`). Stale > 30s = offline; uploads resume-drain transparently after outages (expect timestamp-clumped replay — do not alert on replay bursts).

### Frames
Images/streams are **not** uploaded. Live frame links: worker `http://{WORKER}:9010/frame.jpg`, egg dashboard `http://egg:8765/api/frame`. Link, don't proxy.

## 2. Config plane — dashboard → peer

### Peer endpoint: `GET {PEER}/cfg/<node_id>` → 200
```json
{"v": 7, "hash": "ab12cd34", "cfg": {"fps": 2, "quality": 60, "size": "vga", "led": {...}}}
```
`hash` = first 8 hex of sha256 over canonical JSON of `cfg`. Unknown node → 404.

### Peer endpoint: `POST {PEER}/cfg/<node_id>` body `{"cfg": {...}}`
Validates (`fps` 0–15, `quality` 5–95, `size` in `vga|qvga`, schema-checked `led`), increments `v`, recomputes `hash`, persists atomically, returns the new `{v, hash, cfg}`. Invalid → 400 `{"error": "..."}` (no partial apply).

### Node apply loop (peer → device)
ESP32 nodes GET `/cfg/<id>` from their worker each 30s; apply if `hash` differs from NVS-stored applied hash; report applied `cfg_hash`/`cfg_v` in the next `sensor` record. Sync state per node = `desired.hash == reported.hash` (no extra endpoint).

## 3. LED rule engine (config payload, peer-evaluated)
`cfg.led` shape:
```json
{"presets": {"alert": {"mode":3,"brightness":95,"for_s":8}, "quiet": {"mode":21,"brightness":18}},
 "fallback": "quiet", "cooldown_s": 10, "evaluate_hz": 1,
 "rules": [
   {"name":"crossing","when":"crossing_active","led":"alert","on_s":0,"off_s":5,"priority":9},
   {"name":"bus-full","when":"zone('bus-stop').occupancy > 8","led":"alert","on_s":8,"off_s":20,"priority":7},
   {"name":"idle","when":"true","led":"quiet","priority":0}]}
```
Semantics (v1):
- Condition grammar: comparisons (`> >= < <= == !=`), `AND/OR/NOT`, parens, `true`. Variables: `crossing_active, ped_count, veh_count, occupancy, motion, lux, fps, rssi, stale, paused, time_night, dwell_max_s`. Functions: `zone('<id>').<metric>` (metric: occupancy|ped|veh|crossings_60s|dwell_max_s|inside), `count_in('<cls>', <secs>)`. Parsed via restricted `ast` — no calls/attrs beyond the above.
- Per-rule debounce FSM @1Hz: `IDLE -(true on_s ticks)-> ACTIVE -(false off_s ticks after for_s)-> COOLDOWN(cooldown_s)-> IDLE`. Priority≥8 (safety) rules fire with `on_s:0`; comfort rules carry arm time. Highest-priority **armed** rule wins, ties = most-recently-armed. Fallback rule = immediate idle. `stale` state forces fallback instantly.
- Zones: `cfg.zones` = list `{id, polygon[[x,y]...] normalized, count_line?, classes?, max_occupancy?, dwell_alert_s?, calibration?}`. Peer computes per-zone metrics from its own tracking.
- Output: peer writes `led-intent.json` `{node, ts, rule, preset, mode, brightness, for_s, armed_s, state}` (atomic). Actuation (MCU RPC) is the LED daemon's side of the file contract.
- Mode numbers are the MCU firmware vocabulary (crossing-chickens `firmware/hub9.ino`): 1 rainbow, 2 breathe, 3 kitt, 6 off, 7/8/9 red/green/blue fill, 10 manual RGB, 11 warn, 12 alert, 13 hazard, 14 siren, 15 crossing wave, 16/17 flow left/right, 18 comet, 19 theatre chase, 20 heartbeat, 21 bus-stop beacon. Canonical presets: crossing-active=12/90, bus-full=13/80, crossing-clear=21/18.

## 4. Egg uplink (peer on egg, our daemon `swarmflow-uplink`)
Reads dashboard `GET :8765/api/state` (1Hz, read-only, zero dashboard edits) → derives sensor/flux (from `counts/history`), emits `cfg` record (30s), evaluates LED rules against fresh state → writes `~/swarmflow/led-intent.json`. Queue/retry contract as §1.

## 5. Non-scope (v1)
Auth/TLS (LAN demo), per-record schema evolution (additive fields only; consumers ignore unknown keys), frame uploads, config-push websockets (pull @30s is the sync), multi-central fan-out.
