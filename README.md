# Swarmflow

**Urban intelligence at the edge / Intelligenza urbana all’edge**

Swarmflow connects street cameras, local vision and physical alerts in one operational platform. Designed around Turin’s streets, it gives operators a clear view of crossings, traffic and transit-stop occupancy while keeping image processing close to the sensors.

## Italiano

Swarmflow trasforma i dati delle telecamere stradali in informazioni utili per la sicurezza e la mobilità. Ogni nodo Arduino UNO Q elabora le immagini localmente; la dashboard raccoglie telemetria, eventi e indicatori in una mappa 3D della città.

### Funzionalità

- Rilevamento e tracciamento di pedoni, biciclette e veicoli, con conteggi direzionali.
- Stima della velocità tramite calibrazione del piano stradale.
- Zone configurabili per attraversamenti e monitoraggio dell’affollamento.
- Segnalazioni LED e controllo temporizzato adattivo in base alla presenza di persone e veicoli.
- Monitoraggio delle fermate: persone in attesa, soglie di affollamento e andamento nel tempo.
- Mappa 3D con nodi, posizionamento delle telecamere, semafori e dati del trasporto pubblico.
- Punteggio di attività dell’incrocio calcolato dai dati delle rilevazioni.
- Segnalazioni di possibile collisione e chiamate vocali tramite Fish Audio e Twilio, con abilitazione esplicita e protezione dalle chiamate duplicate.
- Eventi antimanomissione da variazioni persistenti dell’orientamento IMU, trasmessi alla dashboard.
- Buffer video locale di 15 secondi, esportazione di filmati e registrazione con annotazioni.
- Coda locale della telemetria e sincronizzazione automatica dopo la riconnessione.

La velocità dipende dalla calibrazione e dal posizionamento della telecamera. Le segnalazioni di collisione sono basate sulle osservazioni video e richiedono valutazione da parte dell’operatore.

## English

Swarmflow turns street-camera observations into actionable mobility and safety information. Arduino UNO Q nodes process imagery locally; the dashboard brings telemetry, events and intersection activity into a shared 3D city map.

### Features

- Pedestrian, bicycle and vehicle detection, tracking and directional passage counts.
- Ground-calibrated speed estimates and configurable crossing/crowding areas.
- LED alerts and adaptive timed signal control driven by pedestrian and vehicle presence.
- Transit-stop occupancy, crowding thresholds and historical demand indicators.
- A 3D map with camera placement, connected nodes, traffic signals and public transit data.
- An intersection activity score calculated from observed people, vehicles and crossing occupancy.
- Possible-collision alerts and Fish Audio/Twilio voice calls with explicit arming, cancellation delay and duplicate-call protection.
- IMU-based tamper events for sustained camera movement or tilt, forwarded to the server.
- A local 15-second video buffer, clip export and annotated recording.
- Durable offline telemetry queues and automatic synchronization on reconnection.

Speed estimates depend on ground calibration and camera placement. Possible-collision alerts support operator assessment.

## Architecture / Architettura

`IMX219 + IMU → Arduino UNO Q vision → local alerts → authenticated telemetry → Next.js + SQLite → 3D dashboard`

Sensor firmware provides orientation readings. Tamper detection uses a stable orientation reference, consecutive observations and a 30-second event cooldown.

## Hardware

Arduino UNO Q 4 GB, UNO Media Carrier, Sony IMX219, Grove movement/IMU sensor, AHT20 and a 30-LED addressable strip. ESP32 camera workers can publish into the same dashboard ingestion interface.

## Software

Python, OpenCV, Ultralytics/NCNN on the edge; Next.js, React, TypeScript and SQLite centrally; Mapbox/OpenFreeMap for visualization; Fish Audio and Twilio for voice notifications.

## Avvio / Getting started

Dashboard: Node.js 24+, `npm install`, then `npm run dev`. Open `http://localhost:3000`. Configure the public map token and private ingestion credential in `.env.local` using `.env.example`.

Edge: install the Python dependencies in `vision/requirements.txt`, run the vision worker and collector from the same directory, then start the publisher with a private `node-client.json`. Existing systemd units provide service restart behavior. Keep one camera worker per device.

Use `npm run connect:usb` for the UNO Q USB route or `npm run connect:wifi -- <board-ip>` for Wi-Fi forwarding. Configure the voice service locally before enabling calls. Provider credentials and phone numbers remain server-side and are excluded from Git.

## Repository

This repository contains the city dashboard and telemetry integration. The UNO Q software is available in [crossing-chickens](https://github.com/AlpMeteSenel/crossing-chickens).

