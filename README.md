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
