# SWARMFLOW · HackTurin

Next.js city dashboard for one real Arduino UNO Q node (`egg`), starting in Turin. The node continues local YOLO tracking and crossing lights; this project receives its telemetry, keeps history, and renders a city overview.

## Run

Node.js 24+ is required for the built-in SQLite database.

```sh
cd ~/Projects/hackathons/hackturin
npm install
npm run dev
```

For the demo, use `npm run build && npm run start` to run the production server (currently running).

Open http://localhost:3000. The node controls remain at http://localhost:18765.

The dashboard is configured with the supplied Mapbox public token in ignored `.env.local`; the private ingestion credential is separate. Do not commit `.env.local`, `.data/`, or node credentials. `python3 scripts/configure.py` configures another checkout and preserves an existing ingestion secret when updating the map token.

## Connect Egg

The publisher is already installed and enabled on egg as `swarmflow-publisher.service`. Its config and durable outbox are under `/home/arduino/swarm/shared/TASK-048/`. It reads the existing dashboard API; it does not open the camera, run another detector, or use MCU serial.

Wi-Fi (both devices on the same network):

```sh
npm run connect:wifi -- 192.168.1.194
```

Enter the board password in the SSH prompt. The background tunnel links the node's localhost18080 to the dashboard's localhost3000 and links this computer's localhost18765 to the node's8091. It uses a control socket `/tmp/swarmflow-egg-live.sock`, keepalives, and an8-hour persistence window. If Wi-Fi drops long enough to close SSH, rerun the command. To stop this project's tunnel: `ssh -S /tmp/swarmflow-egg-live.sock -O exit arduino@192.168.1.194`.

USB:

```sh
npm run connect:usb
```

Stop an existing Wi-Fi tunnel before switching the same routes to USB. The USB mappings must be restored after the board reconnects. Set `ADB_PATH` if the bundled Arduino ADB is elsewhere.

## Place a camera and people

1. Select the connected camera and choose **Place this camera**.
2. Click its real position in Turin, give it a name and set the viewing direction. Save. The fan is illustrative, rather than a measured camera field of view.
3. Choose **Align ground landmarks**. Match four pavement corners in the held camera image with the same four points on the map, in perimeter order.
4. Save. Fresh confirmed person footpoints are projected onto that flat ground plane and displayed as simple3D avatars. Positions beyond the matched area are amber; unstable/horizon projections are dropped.

A camera location by itself cannot geolocate a detected person. The existing AprilTag on the node gives a local scale; it does not establish geographic orientation or location. Ground-map registration supplies that missing relationship and is saved in SQLite. Keep the camera fixed afterward. Map/vector landmark precision and object-box footpoints limit actual position accuracy. This is a prototype ground-plane estimate, not GPS or an identity system. Track numbers are scoped to each camera.

**Preview3D people** is an explicitly labelled simulated scene. It does not change real counts, events, node telemetry or saved registration. No guessed real camera position/registration is saved.

## Maps

The renderer is Mapbox GL JS with a shared three.js layer. The supplied token loads styles but the Mapbox tile API returned403 during verification. `/api/map-config` checks availability and uses OpenFreeMap/OpenStreetMap data when Mapbox denies tiles. Open map resources pass through a bounded, fixed-host proxy to avoid embedded-browser transport restrictions. The map,3D building extrusions and avatars remain interactive. Source attribution is retained. Once the Mapbox account/token grants tile access, reload after the60-second configuration cache expires to use Mapbox data again.

## Data and controls

- `POST /api/ingest`: node bearer-authenticated live state/archived samples. The ingestion secret never appears in browser API responses.
- The publisher sends current view state first, then drains historical telemetry in chronological batches of up to25 samples in one request. Live display timestamps and archived counter progress are stored separately, so a backlog does not replace the current view.
- Outbox: SQLite,5,000 samples maximum. Camera JPEGs are not stored in the outbox. The publisher resizes the full camera view to512px and compresses its transport JPEG using existing OpenCV (one CPU thread); detection runs on the original pipeline. Current previews are overwritten, including delayed arrivals under one minute (labelled delayed and excluded from live counts/map tracks); they are not incident video recordings.
- Server storage: `.data/swarmflow.sqlite` and current JPEGs. Receipt IDs prevent duplicate counting; older samples do not replace newer positions. Node counter resets are accumulated into retained passage totals.
- Ten-second occupancy/history samples and recent receipt IDs retain up to7 days. The UI shows history/events and offers CSV export. Full video replay is not implemented.
- Crosswalk/bus-stop mode and automatic-light controls are explicit queued commands; they expire after60 seconds if the node cannot acknowledge them. Local manual animations pause automatic crossing lights.
- Crossing automation on egg now saves its enabled state with LED settings and resumes only with a saved camera crosswalk zone. The existing fresh-frame gate remains; manual overrides, bus-stop mode and source switches save the paused state.

The app binds to this computer's loopback interface and uses SSH/USB forwarding. A public internet deployment needs a durable Node runtime/storage and operator authentication; do not expose this local development server as a public traffic-control service. To publish elsewhere later, point node config at that server's HTTPS `/api/ingest`, keep the bearer credential private and add authenticated operator access.

## Checks

```sh
npm run test
npm run typecheck
npm run build
python3 -m unittest discover -s node -p 'test_*.py' -v
```

Tests cover homography projection, degenerate registration, missing/stale map tracks, authenticated and duplicate ingestion, out-of-order samples, counter resets, persisted placements, live state while history drains, command acknowledgements and durable outbox/result recovery. The node crossing-persistence change passed49 isolated backend/vision regressions. Live tests verified publisher submissions and a crossing-light control round trip; physical strip appearance and surveyed position/speed accuracy require field observation.


## Transit stops and camera assignments

`data/turin-stops.json` contains 6,324 GTT BUS/TRAM stop points from BusTO's cached MaTO export, snapshot 22 May 2026. Public stop/route metadata only is copied; BusTO's private database, MQTT configuration and app are untouched. Reimport after refreshing BusTO's catalogue with `python3 scripts/import-busto-stops.py` (optional `--source` export folder). The snapshot date is shown in the transit view; it is not live service information.

In Overview, toggle **Bus stops** to show map points. Click a point or search in **Camera’s transit stop** by name, code or route; confirm the exact side of the road with **Link camera to stop**. The link saves independently of position/calibration/mode. Enable bus-stop occupancy and configure its actual waiting-area boundary in local node controls before collecting counts. No real camera is assigned a guessed stop during development.

The sidebar's **Bus stops** page shows fresh waiting-area occupancy, sampled averages/peaks, hourly peaks, threshold-exceeding samples and saved crowding warnings for the last24 hours. Stale frames, unknown counts, crosswalk mode and replay are excluded. Missing observations are unknown, not zero. Average is over observed10-second buckets, not individual waiting time, boarding totals or proof of demand for a specific line. Overlapping cameras use the maximum count per stop/bucket rather than summing passengers. No automatic GTT dispatch is implemented.

Schema3 adds `nodes.stop_id`, effective-dated `stop_links`, `stop_samples` and deduplicated `stop_warnings`. Changing/unlinking a camera preserves old stop history; delayed packets use the assignment effective at capture time. Older data is not retroactively attributed to a new stop. New endpoints: `GET /api/stops`, `GET /api/stops/analytics`, same-origin `PATCH /api/nodes/[id]/stop` with `stop_id` or null. A runtime SQLite backup was made under ignored `.data/backups/` before migration. Four transit regressions cover link validation/calibration preservation, stale and unassigned packets, dedup/overlapping cameras and reassignment/backlog handling.


## Optional live 3D transit vehicles

The map’s **Live buses / Hide buses** button toggles independent BusTO GPS vehicles. **Find buses on map** zooms to a reporting vehicle nearest the current view. Blue bus-shaped models and route labels distinguish the transit feed from camera detections; click a marker to see line, destination, vehicle ID (if available) and GPS age. This source can include tram services; models are illustrative, not measured fleet geometry. Camera counters and stop occupancy are unaffected.

`GET /api/buses` reads the public `https://app.bus.to.it/api/paths`, using server-side10-second caching, request coalescing, a12-second timeout and a5MB response bound. Only compact validated current positions are returned. Optional server env `BUSTO_API_URL` can target a different compatible deployment; no BusTO database/MQTT credentials are required or copied. Positions older than90seconds turn grey and disappear after180seconds. Failure shows feed unavailable and retains only bounded-age fixes. New GPS reports animate between observed coordinates over1.2seconds; there is no extrapolation beyond the latest position. Source positions retain their original timestamps. Browser polling stops when the layer is disabled.

Files: `src/lib/live-buses.ts` (validation), `src/lib/bus-feed.ts` (upstream/cache), `src/components/BusLayer.ts` (shared-geometry3D models), and `/api/buses`. Parser tests cover coordinates, duplicate vehicle assignments, bearings, stale/expired/future timestamps and malformed rows. This is live feed visualization; bus-arrival and passenger-boarding analytics have not been added.

Camera areas: select a camera → **Draw detection zones**. Choose crosswalk,
vehicle crowding or people crowding; use four perimeter corners or two opposite
corners for a box, enter a threshold, add the area, then save. The full camera
frame is held while drawing. Region counts ignore retained/unconfirmed tracks;
delayed frames show unknown counts. The reserved `crossing` zone also updates
the node's actual crossing boundary through the publisher. Saves preserve existing
signal/stream settings, and worker acknowledgement is displayed separately.
Traffic-signal strip ownership can be released in Camera settings for crossing LEDs.

ESP32 local worker: cloned sibling `../swarmflow-esp32`, with Apple MPS support.
See its `MAC-INTEGRATION.md`. The existing camera gateway is `10.42.0.1:9010`;
the relay preserves source timestamps. One local publisher reads `127.0.0.1:9010`.
Reconnect it with `npm run connect:peer -- esp32cam-1 127.0.0.1` only if another
publisher for the same node is not already running. The UNO Q remains connected
through `npm run connect:usb`, using its on-board publisher (TASK-057).

Intersection visualization: four explicitly placed signals belong to `egg`, at
Via Vincenzo Vela × Via Giovanni Battista Bricherasio (OSM node252417596).
ESP32-CAM is capture-only and has no traffic-light marker or placement controls.
3D signals have poles, housings, visors and lit lenses; 2D retains compact signal
icons. Opposite-pair phases and countdowns use UNO telemetry; stale data turns
lenses dark. **Locate traffic lights** focuses the intersection. Pole locations
are approximate visualization positions derived from street centerlines.

Intersection activity risk is a prototype 0–100 heuristic from confirmed current
people/vehicle counts, co-presence, occupied crossing and available estimated
speed above30km/h. It holds brief detection gaps for about2s, never sums changing
track IDs, and shows unknown for stale data. Dashed links and moving dots are
explicitly illustrative module/controller connections; pulses stop for offline
endpoints. **View connected modules** focuses Egg and ESP32.

UNO adaptive demand now runs swarmflow-adaptive-intersection.service from TASK-058.
Confirmed fresh counts use a2s peak hold; unconfirmed/retained tracks and cumulative
passage counters cannot request green. Pedestrian priority uses a drawn crossing
when available, otherwise full-view presence. The two-car rule uses full-view
vehicle count until a vehicle zone is configured. Yellow/all-red timings retained.

Manual threat fallback lives at the bottom of the page: enable **Use manual score**
and choose0–100. The displayed card keeps a Manual badge and its separate automatic
estimate; camera data and light control are unaffected. Selection persists in this
browser tab for the session. **Hide controls for recording** removes the bottom
panel, preserving the score/provenance; Esc restores it, Shift+R toggles the view.
External OS screen recording cannot be detected automatically; enable recording
view before starting the screen recorder. The dashboard does not start recording.

### Possible collision warnings and voice calls

The bottom **Possible collision alerts** panel enables detection on Egg separately from real calling. Both are off on first use. Confirmed, non-retained person/car boxes at >=50% detector confidence must overlap by 25% of the person's box over at least three distinct fresh captures spanning 0.5 seconds. Thresholds and the spoken location are editable. Occlusion can satisfy this rule: these are **possible collisions requiring human verification**, not confirmed crashes. Camera/model confidence is not collision probability. The node-wide two-minute warning cooldown prevents repeated triggers after ID changes. A speed gate above zero requires an available calibrated car-speed estimate. With a zero gate, missing speeds are explicitly unknown.

The warning stores individual prototype speed estimates and the possible relative-speed range `abs(car-person)` to `car+person`. Without reliable direction vectors this is not an exact impact speed. No speed is synthesized from pixels. The Italian phone message explicitly says possible collision, estimated speeds and human verification; simulated warnings say TEST. Existing crosswalk lights, bus-stop monitoring and camera settings are unchanged.

Voice integration reuses the separate local `/Users/alpme/Projects/fish-call` application via fixed loopback port3001. Credentials and the authorized recipient remain in that project's private `.env`; they are neither copied nor accepted in dashboard requests. To run it: `PORT=3001 node server.js --ngrok` from that directory, with Node22+. Its signed HTTPS audio/TwiML routes and authenticated callbacks are public; its control routes remain private. The Next dashboard is not exposed through that tunnel. For setup see the source application's README.

1. Enable detection and save the actual spoken location.
2. **Create test warning · no call** validates the saved warning and fictional example speeds without provider requests.
3. **Generate voice preview · no call** uses Fish Audio and can consume its credits. Listen in the dashboard.
4. Check the masked recipient, accept real calls/provider charges, then explicitly enable automatic Twilio calls. Arming expires in ten minutes and is lost on Next server restart.
5. For a test telephone call, press **Call configured recipient** and confirm the browser prompt. The agent does not place test calls.

Automatic calls require both switches on, wait five seconds, and recheck the arm session after speech generation. Disarming or canceling preparation blocks calls not yet submitted. One in-flight call plus a two-minute call cooldown prevents duplication. Each attempt is journaled before the provider POST; ambiguous outcomes stay held, and the Fish app additionally persists its own Twilio safety journal/active-call checks. No automatic retries are made. A submitted call cannot be recalled by the dashboard cancel button. Incidents and detection settings persist in ignored `.data/crashes.sqlite`; the warning is also added to existing event history.

**Hide controls for recording**, or Shift+R, removes the bottom controls. Esc restores them. This is an explicit recording view, not OS recording detection. Saved warnings remain visible; hiding controls does not disarm calls. For safety disable calling when the demo ends. Caller status reflects the local Fish app; the default Twilio callback reports completion, not every call progression state.

### Prerecorded demo call trigger

The bottom **Staged demo · 4 km/h** section prepares a short English Fish Audio recording: “This is a Swarmflow demo simulation. A car hit a pedestrian at [saved location], at a simulated speed of four kilometres per hour. No real collision has been detected.” Preparing generates speech and verifies its public HTTPS audio without making a call. Play its preview before the demonstration.

After accepting calls/charges, explicitly **Arm demo call**. This arm is separate from live crash detection and works without a camera connection; keep live automatic calling off for a staged demo. **Click the status pill above the camera preview** (Live, Delayed frame or Connecting) to trigger a real call to the existing configured recipient using the prepared clip, even in recording view. The keyboard shortcut has been removed. The click does not generate new TTS, invent detections or change counts. Saved events and the spoken message identify the simulation.

Demo arming expires in ten minutes or on dashboard restart. The cached clip is valid for the voice service's recording lifetime (normally one hour); changing the saved location invalidates it. A voice-service restart invalidates its signed audio: prepare again. A five-second cancellation window, two-minute call cooldown, in-flight lock and uncertain-outcome hold still apply. Disarm demo calling to prevent hidden triggers; hiding controls alone leaves it armed.
