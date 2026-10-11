# SWARMFLOW / HackTurin — website agent handoff

Prepared 11 October 2026, Europe/Rome. This file transfers the existing implementation; continue it instead of creating another dashboard.

## Start here

The user wants an attractive, simple city dashboard for the Adaptive Urban Vision Network, demonstrated in Turin. One Arduino UNO Q performs local camera detection, tracking, counting, speed estimation and pedestrian crossing LED control. This Next.js website receives node telemetry, stores events/history and displays cameras and estimated anonymous people on a 3D city map. Bus-stop occupancy is a second node mode.

**Main project:** `/Users/alpme/Projects/hackathons/hackturin`

**Website:** http://localhost:3000/

**Local node controls through a tunnel:** http://localhost:18765/

**Last known board:** `arduino@192.168.1.194`, hostname `egg`, Wi-Fi SSID `Bom dia`.

### Actual status when this handoff was written

- The production Next.js server is listening on loopback port 3000, and `/api/overview` responds.
- The SSH control socket `/tmp/swarmflow-egg-live.sock` is now absent. The board is shown offline in the website. Reconnect the tunnel before assuming camera/publisher failure.
- SQLite contains the real `egg` node and 80 events returned by the overview API. Its camera location **is now saved**, but it has **zero ground landmark pairs**. Geographic person projection therefore remains unconfigured. Preserve the saved location.
- The last stored packet was captured at `2026-10-11T00:40:36.300491Z`: crosswalk mode, automatic LEDs enabled, 1.5 FPS. This is cached telemetry, not a live board check or identification of its current model.
- Earlier live verification found egg over Wi-Fi, restored forwarding, saw a fresh frame at 790 ms with a car detection, and verified publisher queue zero/no errors/no restarts after the retry fix. Network delays also reached 7–8 seconds per request and much older displayed frames. Wi-Fi signal was −72 dBm. Rates and settings vary; measure again.
- Another agent has worked on saved camera rotation (`TASK-051`, agent `camera-rotation`). Read current board coordination before touching camera/MCU files; a Mac snapshot can be older than its changes.

## User preferences and boundaries

- The user is short on time. Make practical changes, run focused checks, give the URL, and keep updates concise.
- Use the existing Next.js project in the requested Projects/hackathons/hackturin directory.
- Keep the UI easy for ordinary users: Overview, Events, Insights, place camera, align ground, choose monitoring mode.
- Keep the full camera field of view. Do not crop the middle to improve apparent detection.
- Physical hardware: **one** competition-provided UNO Q, not three. No thermal sensor. Use available sensors and the 30-LED strip.
- Local crossing safety must continue when this website or the internet is unavailable.
- Detection confidence percentages are not measured accuracy. Do not fabricate speeds, positions, FPS, physical LED success or mesh capability.
- The user authorized continued website work and the node integration. No public deployment, public traffic-control exposure or messages to other people were requested.

## Run and edit the website

Node.js 24+ is required by `node:sqlite`. Current Mac has Homebrew Node 24 and npm 11. Dependencies are already installed.

```sh
cd /Users/alpme/Projects/hackathons/hackturin
node --version
npm run dev
```

Development uses Webpack, port 3000, bound to `127.0.0.1`. Turbopack previously crashed on the Mac's sandbox/FSEvent watcher; keep the existing Webpack scripts.

For the demo:

```sh
npm run build
npm run start
```

Do not start another server on the occupied port. Check `lsof -nP -iTCP:3000 -sTCP:LISTEN`, identify the existing project process and stop it gracefully if a restart is necessary. Prefer stopping development before a production build/restart; avoid simultaneously using the same `.next` output from both.

The last production server output is `/tmp/hackturin-server.log`; build output is `/tmp/hackturin-build-final.log`. `/tmp` files and process IDs are ephemeral. Mac startup/server autostart has not been configured.

If npm cache permissions fail, use `npm install --cache /tmp/hackturin-npm-cache`. Work in the requested project with the needed filesystem/network permissions; sandbox `EPERM` on localhost does not prove the server is down.

Read the project's `AGENTS.md`. It requires relevant Next.js docs from `node_modules/next/dist/docs/` before coding. Route handler reference is `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.

Stack: Next 16.4.0, React 19.2.4, TypeScript, Mapbox GL JS 3.32.0, three.js 0.186.1, lucide-react, built-in SQLite. Git is initialized, but this agent made no commits or PRs. Inspect current Git status; do not reset other agents' changes.

## Connect over Wi-Fi

Put the Mac and board on the same network. The last IP can change after DHCP/reconnection. Try `egg.local`; if unavailable, check Arduino App Lab or the router's device list for egg. `arp -a` is useful context. Avoid arbitrary repeated scans or Wi-Fi reconfiguration.

From the project:

```sh
npm run connect:wifi -- 192.168.1.194
```

Enter the board's existing SSH password interactively. Ask the user for it if this agent does not already have it through authorized context. It is deliberately not duplicated in this handoff or stored in the project.

The script starts a background SSH master with:

- control socket `/tmp/swarmflow-egg-live.sock`;
- local forward `Mac 127.0.0.1:18765 -> egg 127.0.0.1:8091`;
- remote forward `egg 127.0.0.1:18080 -> Mac 127.0.0.1:3000`;
- keepalive every 10 seconds, three missed responses, eight-hour control persistence;
- forwarding failure detection and normal SSH host-key handling.

Useful commands:

```sh
ssh -S /tmp/swarmflow-egg-live.sock -O check arduino@192.168.1.194
ssh -S /tmp/swarmflow-egg-live.sock arduino@192.168.1.194
curl --max-time 5 http://localhost:18765/api/state
```

Direct node dashboard on LAN: `http://192.168.1.194:8091/`. `8091` is the integrated dashboard; older 8765 references belong to earlier work.

To deliberately stop this project's tunnel:

```sh
ssh -S /tmp/swarmflow-egg-live.sock -O exit arduino@192.168.1.194
```

Do not run a second tunnel on occupied ports. If the socket is stale, first check whether its SSH process is still alive. Reconnect after a long Wi-Fi outage, Mac restart or board power cycle. The node publisher starts automatically; the Mac server and tunnel currently need to be started separately.

## USB alternative

Connect exactly one UNO Q by USB. Stop conflicting Wi-Fi forwards before switching to USB:

```sh
cd /Users/alpme/Projects/hackathons/hackturin
npm run connect:usb
```

The script discovers the device, runs ADB reverse `tcp:18080 -> tcp:3000` and forward `tcp:18765 -> tcp:8091`. Restore mappings after unplug/reconnect. It uses the installed Arduino ADB or `ADB_PATH`:

```text
/Users/alpme/Library/Arduino15/packages/arduino/tools/adb/32.0.0/adb
```

Previously observed serial: `3409224453`; discover again rather than assuming. `adb devices` confirms detection. `adb -s <serial> shell` provides a board shell when supported; it is not a second camera app.

## Credentials and configuration

- Ignored `.env.local`: supplied `NEXT_PUBLIC_MAPBOX_TOKEN` and separate private `NODE_INGEST_SECRET`.
- Ignored `.data/node-client.json`: publisher config, including private bearer token.
- Board config: `/home/arduino/swarm/shared/TASK-048/node-client.json`, mode 0600.
- Existing config endpoint: `http://127.0.0.1:18080/api/ingest`; local state/config URLs use `127.0.0.1:8091`; interval one second; node ID `egg`.
- `python3 scripts/configure.py` can configure another checkout. It preserves an existing ingestion secret when updating the public map token. Do not run it unnecessarily or rotate only one side of the connection.
- Keep `.env.local`, `.data/`, node credentials, SSH passwords and camera bytes out of commits, handoff copies, logs and screenshots of configuration. `.env.example` has placeholders.

## Architecture and important files

```text
IMX219 -> one capture process -> YOLO/tracker worker on egg
                               -> collector/local dashboard :8091
                               -> local MCU crossing commands / LED strip
                                         |
                              independent publisher on egg
                              SQLite outbox, current state first
                                         |
                           SSH reverse or ADB reverse :18080
                                         |
                            Next.js :3000 /api/ingest
                            SQLite + last JPEG -> city UI
```

| File | Responsibility |
| --- | --- |
| `src/components/Dashboard.tsx` | UI, polling, camera panel, modes/LED control, placement/alignment, events and insights |
| `src/components/CityMap.tsx` | Mapbox renderer, building extrusions, three.js people, pins, map clicks, labelled simulation |
| `src/app/globals.css` | Responsive mint/cream design and all layouts |
| `src/lib/types.ts` | Telemetry, tracks, placement, commands and overview contracts |
| `src/lib/store.ts` | SQLite schema, validation, ingestion/deduplication, totals/events/history, controls and previews |
| `src/lib/geo.ts` | Turin center, local coordinates, four-point homography, person footpoint projection |
| `src/lib/http.ts` | JSON body bound, error responses, same-origin check |
| `src/app/api/**/route.ts` | API handlers |
| `node/publisher.py` | Independent node client, preview compression, durable outbox, batched upload and command ACKs |
| `node/swarmflow-publisher.service` | Node user service configuration |
| `scripts/connect-wifi.mjs`, `scripts/connect-egg.mjs` | Wi-Fi and USB forwarding |
| `tests/*.test.ts`, `node/test_publisher.py` | Meaningful regression checks |

Routes:

- `GET /api/overview`: nodes, events, history, server time; no credential in responses.
- `POST /api/ingest`: bearer-authenticated current packet or `{samples:[...]}` archive batch, maximum 25.
- `PATCH /api/nodes/[id]`: camera name and placement (`lng`, `lat`, `heading`, `pairs`).
- `POST /api/nodes/[id]/control`: explicit `camera_mode` and/or boolean `auto_led` only.
- `GET /api/nodes/[id]/frame`: most recently stored JPEG.
- `GET /api/export`: history CSV.
- `GET /api/map-config`: choose Mapbox or open-map fallback; 60-second availability cache.
- `GET /api/map-proxy?url=...`: bounded resource proxy restricted to HTTPS `tiles.openfreemap.org`.

Capture timestamps are epoch **seconds**. Server/history/event timestamps are generally epoch **milliseconds**. Boxes and image landmarks are normalized 0–1 coordinates; map coordinates are `[longitude, latitude]`. Consult types/source rather than mixing these units.

## Data semantics — preserve these

The publisher reads existing `/api/state`; it never opens camera/MCU serial or runs YOLO. It uses `/home/arduino/yolo-env/bin/python` and existing OpenCV, with one thread to resize the full-view transport preview to width 512 and JPEG quality 68. This changes transmitted preview quality only, not detection input or crop geometry.

It uploads `live_only: true` current state first, then historical samples in a **single request per batch**. Historical packets omit camera bytes. SQLite outbox caps at 5,000 samples and survives connectivity loss. Only explicitly acknowledged sample IDs are removed. Command results persist until acknowledged. Network timeout is eight seconds; connection failures retry without referencing an undefined command ID (a previous bug, now covered by a regression test).

Website `.data/swarmflow.sqlite` uses WAL. Tables include nodes, receipts, history, events and commands. Schema version 2 separates `last_capture` for the displayed current state from `last_counter_capture` for archived counter progression. Do not collapse those timestamps: old queued history must not replace a current view or prevent counts from catching up.

- Duplicate packets do not count twice. Older samples do not overwrite newer state. Reset node counters accumulate into retained website passage totals.
- Current visibility counts differ from directional passage totals.
- A node is online after a submission within eight seconds. A live frame is fresh only within 2.5 seconds (with small clock tolerance). Delayed previews up to one minute can update the last-frame image, but are excluded from live counts and map positions.
- A dash for current counts means no fresh observation, not zero people. Keep the true frame age and delayed label.
- Receipt/history retention is bounded to seven days; the UI presents 24-hour history. Events are saved telemetry, not video replay. Only the latest preview is stored.
- Explicit mode/light commands expire after 60 seconds and require a node acknowledgement. Do not optimistically claim lights changed.
- Same-origin operator requests are supported for this loopback app. Ingestion has bearer authentication. Public multi-user operator authentication/deployment has not been implemented.

## Map and geographic calibration

Default center is Turin `[7.6869, 45.0703]`, timezone Europe/Rome. The supplied Mapbox token loaded styles but its tile API returned 403. Do not assume a billing/root cause. The app currently uses OpenFreeMap/OpenStreetMap data through Mapbox GL JS and three.js; retain attribution.

The fallback proxy is important in the embedded browser. **`transformRequest` must return an absolute localhost proxy URL** (`new URL(..., window.location.origin).href`), including for worker resource requests. Relative URLs produced a blank base map in production; absolute URLs restored real Turin streets/buildings. The proxy allows only a fixed host, no credentials/ports/redirects, 12-second timeout, 8 MB resource bound and a 96-entry cache. Do not make it an arbitrary URL proxy. OpenFreeMap vector tiles have maximum native zoom 14; allow normal overzooming from TileJSON rather than requesting nonexistent z15/z16 data.

User workflow:

1. Place/edit the camera at its real location and set viewing direction. Existing placement must be preserved.
2. Select **Align ground landmarks**. Match four actual pavement corners between the held image and map, in perimeter order, all on one flat plane.
3. Save. Confirmed fresh person box bottom-centers project to the ground map. Extrapolated positions are amber; invalid/horizon or implausibly distant projections are dropped.

An AprilTag gives local metric scale; it does **not** establish geographic camera location/orientation. A camera pin alone also cannot geolocate people. Camera movement/rotation, map landmark precision, lens distortion and box footpoints limit accuracy. Do not claim survey-grade locations. The coverage fan is illustrative, not calibrated field of view.

**Preview 3D people** is simulated and explicitly labelled. It changes no real counts, events or saved placement. Turn it off before leaving the real operational view. Anonymous track IDs are camera-local, not cross-camera identities.

## Node hardware and software context

- One Arduino UNO Q 4 GB, IMX219 Raspberry Pi Camera v2 style (~25 × 24 mm), UNO Media Carrier.
- 30 WS2813 LEDs, D6/PB1; working firmware transport uses the established open-drain/pull-up arrangement. Do not replace wiring or flash a different driver casually.
- Grove AHT20 temperature/humidity, light input A0, PIR D2, IMU on its established bus. No thermal camera/sensor or LTE modem is installed.
- Linux runs optimized YOLO26n NCNN CPU models, typically two inference threads. 320/416/640 and experimental native detail/tile sweeps are available on the **local** node dashboard. External website does not yet expose those controls.
- Historical benchmark: about 158 ms for 320 and 236 ms for 416 prediction-only; GPU/Vulkan was slower on this board. These are bounded tests, not end-to-end camera FPS or measured accuracy. Tiling increases work; NCNN batching here was sequential, not a free GPU speedup.
- Camera pipeline has automatic exposure/gain, full view, simplified RAW10/color processing and a dedicated capture process/latest coherent snapshot. Reuse it; do not start a second camera consumer.
- Speeds need measured ground geometry or AprilTag calibration and a fixed camera. The local system estimates km/h across the same plane, flags extrapolation and rejects unstable projections. Percent confidence is not speed accuracy.

Production node app: `/home/arduino/swarm/shared/TASK-012`.

Key enabled services at last verification:

```text
swarmflow-vision.service          user: collector/local dashboard
swarmflow-vision-worker.service   user: camera/vision worker
swarmflow-publisher.service       user: external telemetry client
swarmflow-mcu.service             system: start existing MCU sketch
```

Node publisher files are under `/home/arduino/swarm/shared/TASK-048/`; its installed unit is `~/.config/systemd/user/swarmflow-publisher.service`.

In an egg shell:

```sh
export XDG_RUNTIME_DIR=/run/user/1000
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
systemctl --user status swarmflow-publisher.service --no-pager
cat ~/swarm/shared/TASK-048/publisher-status.json
journalctl --user -u swarmflow-publisher.service -n 30 --no-pager
curl --max-time 8 http://127.0.0.1:18080/api/overview
```

Status JSON includes last upload, queued samples and error. Fix the tunnel/server first if the remote-forward URL fails. Restart **only** the publisher if deploying publisher changes; no camera or MCU restart is needed.

### Crossing and bus-stop behavior

The local crossing algorithm remains separate from bus-stop occupancy. Confirmed fresh live person footpoints inside the saved crossing polygon request warning LEDs; stale/unavailable frames do not drive unsafe alerts. Manual animations pause automatic crossing lights. Bus-stop mode uses its own saved boundary and threshold; it is not an automatic crossing trigger.

TASK-048 changed the collector to persist the automatic LED setting along with brightness/effects. It restores enabled automation only with camera source, crosswalk mode and a saved zone. Manual overrides, source switches, bus-stop mode or zone removal save it paused. The local **1.5-second safety gate** remains unchanged. Do not weaken it to disguise Wi-Fi or inference latency. External Wi-Fi delay is not necessarily the local LED reaction delay.

Bus-stop crowding counts confirmed current people inside its boundary, uses consecutive fresh frames for threshold confirmation, saves one warning per episode, and rearms after fresh below-threshold observations. Settings/warning state are stored separately from crossing profiles. External mode selection works; threshold/boundary editing currently happens on the local node dashboard.

Firmware hub9 includes modes 0–33, the newer animation themes, colors, speed/width and global brightness. MCU ACKs/pin checks do not prove the physical strip's appearance. The user previously confirmed red on all LEDs and alternating hazard halves, but also later reported fixed/off animations. Ask for a physical check only if needed for actual hardware work.

## Multi-agent coordination on egg — mandatory before board changes

Read `/home/arduino/swarm/AGENTS.md`, current `board/` cards and `registry/`. Coordination is through `~/swarm/`, not assumed chat state.

This work used agent `camera-cad`, TASK-048 (external dashboard/publisher/crossing persistence), now in review. No leases were held at handoff. Other agents may have changed node settings since then, especially camera-rotation/TASK-051. Create/claim your own current task through `~/swarm/bin/swarm`; do not silently reuse a completed claim or overwrite another agent's files.

Hardware uses leases:

```sh
~/swarm/bin/hwlock status
~/swarm/bin/hwlock acquire <agent-id> camera
~/swarm/bin/hwlock check <agent-id> camera
~/swarm/bin/hwlock release <agent-id> camera
```

Use `mcu-serial` for MCU controls, the narrow relevant resource for camera/GPU/I2C, and renew/check fencing epochs during longer jobs. File reads and read-only status probes are exempt. Flash/reboot/apt/boot/network reconfiguration require the relevant global lease and explicitly authorized task. Do not reboot or flash to fix the website. Journal hardware state changes and release all leases before ending. Report artifacts through `swarm report`.

The current board production files are authoritative. Mac `work/vision-integration/` is a useful implementation snapshot, **not permission to overwrite the whole live directory**. Compare/fetch current files and preserve other agents' changes before a focused deployment.

## Validation and artifacts

From the website directory:

```sh
npm test
npm run typecheck
npm run build
python3 -m unittest discover -s node -p 'test_*.py' -v
```

Last website validation: nine TypeScript tests, three publisher tests, typecheck and production build passed. Tests cover projection/invalid geometry, stale tracks, authentication/dedup/counter reset, saved placement, controls/ACK, current state versus backlog, bounded historical batches, durable outbox and timeout/retry recovery. The crossing-persistence deployment passed 49 isolated node tests. Other node tasks have their own larger suites; rerun relevant current tests instead of combining all historical counts.

Original workspace:

```text
/Users/alpme/Documents/Codex/2026-10-10/referenced-chatgpt-conversation-this-is-an
```

Useful local artifacts under its `outputs/`:

- `turin-dashboard-wifi-final.png`: last website proof, real map/fallback and node data.
- `frame-age-fix.md`, `frame-age-comparison.json`: dedicated capture-process work and bounded timings.
- `detection-quality-benchmark.json`, `resolution-benchmark.json`, `egg-benchmark-report.md`: older model/detail benchmarks.
- `bus-stop-feature.md`: occupancy/latch/warning semantics.
- `led-studio-live-check.json`: latest animation control evidence.

Older `current-status.md`, READMEs and screenshots may reference indoor scenes, older firmware/settings or previous ports. Treat dates and live state as authoritative. Earlier `turin-dashboard-preview.png`/placement screenshots include the old blank-map issue; do not use them as current proof.

## Recommended next work, in order

1. Reconnect egg over Wi-Fi or USB and verify current publisher/service state. Measure node frame age separately from transported frame age. Preserve honest stale indicators.
2. Inspect existing saved camera placement, then help complete the four ground landmark pairs. Do not invent coordinates. Validate real map alignment with a person at known pavement points before claiming accurate positions.
3. Check the latest rotation task. Moved/rotated cameras can invalidate crossing polygons and calibrations; preserve or correctly transform settings rather than assuming they still fit.
4. Improve external control usability as requested: bus-stop threshold/region, model/detail controls, track list with confidence and km/h could be added through explicit validated/acknowledged commands. The publisher currently whitelists **only** mode and auto LED; extending controls requires changes on both sides plus focused tests.
5. Investigate sustained Wi-Fi delays without weakening safety/freshness gates. Check competing streams, signal, payload size and actual request timing before changing inference. Avoid claiming that a single fast sample establishes reliable latency.
6. Mapbox tile permission can be fixed in the user's account if they want; keep the working fallback meanwhile. Do not replace the functioning map merely because its provider differs.
7. If public hosting is later requested, design durable storage and authenticated operator access first. Current local SQLite/loopback deployment is a hackathon prototype.

Future multi-node true mesh, LTE gateways, emergency dispatch, city traffic-light control and automatic transport capacity changes remain project vision; this one-node website does not implement them. Make the live demo impressive using truthful visualizations, recorded events and explicit simulations.

## Suggested first instruction for the next agent

“Read this handoff and the existing project README/AGENTS.md. Continue SWARMFLOW in `/Users/alpme/Projects/hackathons/hackturin`. Reconnect egg if needed, inspect current board coordination before hardware changes, preserve credentials/data and other agents' work, and improve the existing city dashboard. Start by reporting the current live connection and map calibration state; do not rebuild the project from scratch.”


## Update: BusTO transit-stop integration (11 October 2026)

The website now includes `data/turin-stops.json` (6,324 GTT bus/tram stop points; May22 snapshot) and `scripts/import-busto-stops.py`. `src/lib/stops.ts` loads the public catalogue, and `src/components/Transit.tsx` supplies searchable camera assignments and the Bus stops analytics page. CityMap has a toggled point/label layer and selection popups. Stop metadata is static; no BusTO credentials or live vehicle subscription was copied.

Schema3 in store.ts introduces effective-dated assignment history and observed occupancy/warning records. Link/unlink uses `/api/nodes/[id]/stop`; catalogue `/api/stops`; last24h analytics `/api/stops/analytics`. Samples begin after linking, require actual fresh-at-node bus-stop occupancy, and use maximum count across overlapping cameras. Link does not switch the node mode or redraw its waiting boundary. Preserve all existing camera calibrations. No real stop association was guessed for egg. Backend tests use isolated temporary databases.

The local Next server was restarted for these changes; the ingest hub/bridge and Arduino services were left alone. See README's transit section for semantics and refresh instructions.


## Update: optional live BusTO 3D vehicles

Live buses toggle now reads `/api/buses` backed by BusTO's public `/api/paths`. The web server caches/coalesces fetches; camera/board services are not changed. `BusLayer.ts` renders reusable bus-body/windows/wheel meshes and animates between real GPS updates. Blue/grey transit markers have route labels and timestamp popups, independent of camera counts.90s stale and180s expiry gates preserve honest age. The feed includes transit vehicles potentially running tram routes; dimensions are illustrative. Find buses on map uses the nearest reporting vehicle; no guessed positions are persisted. See README for file paths/configuration.

## 2026-10-11 merge and ESP worker integration

Pulled origin/main through ece583c and merged with local Turin stops/live 3D buses.
Local preservation commit 59e4b39; merge d1d717a. No push was requested.
RegionEditor replaces the old zone modal: held full image, four corners or box,
geometry validation, undo/remove, explicit thresholds and zone-aware rules.
Publisher accepts both `{ok:true}` and the ESP worker's exact versioned config
response; failed/partial saves do not get a success acknowledgement. `crossing`
is mirrored into `/api/config` zone without enabling LEDs or resetting calibration.
Authenticated reported config seeds missing server config, never overwrites operator edits.

UNO Q ADB serial3409224453, current Wi-Fi10.42.0.102. USB reverse18080→3000,
forward18765→8091 and19011→9011. Deployed publisher in
/home/arduino/swarm/shared/TASK-057; enabled user service preserves TASK-048 outbox.
Only telemetry publisher restarted. No firmware flash/camera restart/network change.

ESP32 worker cloned at /Users/alpme/Projects/hackathons/swarmflow-esp32.
Local MPS worker9010, frame relay from10.42.0.1:9010, publisher from127.0.0.1:9010.
Read sibling MAC-INTEGRATION.md and run-mac.sh for restart. The hotspot gateway
must remain on. Do not concurrently launch a second ESP publisher. Runtime and
credentials are ignored. Recent actual inference28–47ms; incoming camera cadence
is variable (~0.3–1.2fps in observed windows), not an inference bottleneck.

Browser box drawing/add/cancel verified without leaving test geometry on real cameras.
Unchanged config round-trips passed for UNO and ESP peer; configuration ack means
peer acceptance, while ESP hardware applies streaming config on its next gateway poll.

## Four intersection lights, 2026-10-11

Removed automatic signal-at-every-camera fallback. ESP32-CAM is explicitly
excluded from signal ownership/rendering/placement controls. Saved four `egg`
placement.signals around Via Vela × Via Bricherasio, center7.666883,45.0652631
from OpenStreetMap node252417596. Camera pins remain at Largo Vittorio Emanuele II.
No node firmware or timing change. Source layout backup/provenance in the Codex
workspace outputs/vela-bricherasio-signal-layout.json. These are illustrative
pole locations, not surveyed municipal infrastructure.

TrafficLightLayer uses shared Three geometry/materials and retained actors for
metal poles, bases, housings, visors and emissive lenses. mapSignals requires
explicit placements and a signal controller; stale telemetry clears lit phases.
Countdown badges retain per-light UNO phases, while **Locate traffic lights**
fits the intersection. Signals1+3 and2+4 follow opposite road pairs.
Browser confirmed four UNO markers, phase changes, and no console errors.

## Stable demand, activity score and logical links

TASK-058 adds StableDemand and a patched copy of the actual board uplink/engine,
under /home/arduino/swarm/shared/TASK-058. Original swarmflow-uplink sources and
cfg remain untouched; its user service is disabled to avoid duplicate MCU writers.
Enabled own swarmflow-adaptive-intersection.service preserves the queue/intent
paths and serves the same9011 config endpoint. Rollback: disable the adaptive unit
and re-enable swarmflow-uplink.service. No firmware, capture, packages or network
changes. Narrow MCU lease released after deployment.

Fixed inactive zone('cars') reference when no cars zone exists, withveh_count>=2,
2s arm/3s release. Added crossing_active==1 pedestrian priority20, immediate arm/3s
release. Counts are current confirmed detections, not cumulative passage totals.
2s peak hold tolerates unstable IDs/dropouts; stale/nonlive observations clear demands.
A drawn crossing limits pedestrian demand; no crossing uses conservative full-view
presence (explicit decision.json ped_scope). Existing Intersection timing/clearance
engine unchanged. Four isolated checks passed locally and on board; live cfg command
acknowledged with hash96505de1 at installation. No physical car/pedestrian field trial.

Next IntersectionRisk:0–100 prototype activity heuristic, explained factors,
short count hold, stale unknown. map logical dashed links between UNO/ESP pins and
UNO/intersection centroid, animated only for online endpoints; labelled illustrative.
Map toolbar View connected modules fits both locations. No actual mesh route claim.

## Manual threat-score fallback and recording view

ThreatFallback at page bottom controls browser-session-only displayed risk0–100.
Default is automatic; manual mode always displays Manual and keeps automatic
estimate/live observations distinct. It never changes node control or telemetry.
Hide controls for recording conditionally removes the panel and scrolls to overview;
Esc restores, Shift+R toggles outside input fields. No reliable external macOS recorder
hook exists, so user must enter recording view before recording. No recording API,
permissions, media storage, or video export added. Typecheck/build passed; browser
verified85/100, Manual provenance, panel absent in recording view, Esc restoration,
then restored automatic mode and candidate50. Source lives in components/ThreatFallback,
Dashboard and IntersectionRisk. Server remains on localhost3000.
