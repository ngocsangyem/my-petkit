# Live event stream: `GET /api/ws`

The one WebSocket the user plane offers for data. It is not in `openapi.yaml`
(OpenAPI cannot describe a socket). The two-way audio socket
`/api/devices/{id}/talk` is a separate protocol and is not covered here.

Source of truth: `features/logs/routes.py` (`api_ws`) and `web/hub.py`
(`EventHub`), under `services/api/src/my_petkit/`. Where this file and the code
disagree, the code wins and this file is fixed.

## Connecting

- Risk tier `R0*`: any authenticated principal — a `Bearer` client token, the
  session cookie, or Home Assistant Ingress.
- The upgrade gets the same cross-site checks as an unsafe method: the `Host`
  must be allowed (`403 host_not_allowed`; not checked for Ingress), and an `Origin`, when sent, must
  match it (`403 origin_not_allowed`). A cookie or Ingress client that sends no
  `Origin` is refused (`403 origin_required`); a bearer-token client may omit it.
- Refusals arrive as the usual JSON error envelope, before the upgrade.

## Frames

Server to client only, each one JSON text frame. The server never reads what
the client sends; inbound frames are ignored.

On connect the server first replays up to the **last 80 events**, oldest first,
then sends each new event as it is published. There is no gap or duplicate
between the replay and the live tail.

Every event has this envelope:

| key         | type            | notes                                               |
|-------------|-----------------|-----------------------------------------------------|
| `seq`       | integer         | monotonic per server process; restarts at a restart |
| `ts`        | number          | Unix time, seconds with fraction                    |
| `kind`      | string          | see below; an open set, so ignore unknown kinds     |
| `device_id` | any, or `null`  | the device's id when known; `null` (or the raw client id) for an unregistered MQTT client |
| `summary`   | string          | one human-readable line                             |
| `detail`    | any             | only on some kinds; shape varies by kind            |

Values under credential-looking keys are masked and strings are scrubbed before
an event leaves the server, in the replay and live alike.

### Keepalive

- When nothing has been published for **25 s** the server sends
  `{"kind": "ping", "ts": <number>}` (no `seq`, `device_id` or `summary`). The
  panel treats a missing ping as "disconnected".
- Independently, aiohttp sends protocol-level ping frames every 25 s.

### Backpressure

Each connection has a queue of 200 events. When a slow client lets it fill, new
events for that client are **dropped silently**; the connection stays open.
`GET /api/events` returns the same ring buffer (up to 800 events in memory) for
catching up.

## Event kinds

| kind      | emitted when                                                       | `detail`                                                                 |
|-----------|--------------------------------------------------------------------|--------------------------------------------------------------------------|
| `http`    | a device-plane HTTP request completes; summary `METHOD path -> status` | `method`, `path`, `status`, `device_type`, `headers`, `query`, `req_body`, `resp_body` (capped), plus `proxy` / `body_dropped` when relevant |
| `mqtt`    | an MQTT message passes the bridge or the proxied upstream          | `topic`, `direction`, `client`, `origin`, `payload` (text, capped at 4000 chars) |
| `connect` | an MQTT client connects or its session ends, a device reports no MQTT session, or a device goes offline | none                                         |
| `cmd`     | a command is sent to a device or BLE accessory; summary `-> transport: what` | none                                                            |
| `redact`  | proxy mode rewrites something coming from the real cloud           | HTTP: `rule`, `path`, `endpoint`, `upstream`, `original`, `note`; MQTT: `rule`, `topic`, `original`, `note` |
| `blocked` | proxy mode blocks a remote command or an OTA push                  | as `redact`; an OTA push: `topic`, `payload`                              |
| `event`   | a device reports a feeding/eating/litter event                     | the stored event row (HTTP path only; none from MQTT)                    |
| `media`   | a raw upload lands, `file_info` arrives, or a photo/video is ready | none, or `path` + `category`, or `stitched: true` + `category`            |
| `devlog`  | a device uploads a log file                                        | none, or `size`, `key`, `uploadres`                                      |
| `patcher` | a firmware patch step runs (progress lines)                        | none                                                                     |

The panel refreshes its timeline when a `media` event arrives.
