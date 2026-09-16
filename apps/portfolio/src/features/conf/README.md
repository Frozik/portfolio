# Conf

A two-person video call with AR glasses and an emotion emoji composited into the outgoing stream by MediaPipe.

Live: [https://frozik.github.io/portfolio/conf](https://frozik.github.io/portfolio/conf) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/conf/`.

2-person video call with AR "glasses" and an emotion emoji baked
straight into the outgoing video stream — fully in-browser, no plugins.
Create a room, share the link; no sign-in required.

**Lobby** (`/conf`) — locally remembered rooms you created or visited,
plus Create and Join-by-link actions. Calls are anonymous: a room id is
all a participant needs, and the room list never leaves the browser.

**Room** (`/conf/:uuid`) — local + remote video tiles, side-by-side on
desktop and stacked on mobile, with mute audio / mute video / a
glasses-style picker (none / round / pink hippie stars / teacher
rectangles) / share link / leave controls, plus a quality badge and
an RTT sparkline. Each browser keeps a persistent participant id
locally, so a WiFi drop and return reclaims the same slot even while
the peer is still showing "Peer disconnected". A third joiner is
politely turned away with a "room full" message.

**Behind the scenes:**
- Each side runs Google's MediaPipe face detector on its own camera
  feed, draws the chosen glasses sprite and emotion emoji onto a
  hidden canvas, and sends that composited canvas as the outgoing
  video track — the remote peer receives an already-finished frame,
  with no remote-side detection and no overlay element. The same
  trick lets the user switch glasses style or mute / unmute without
  renegotiating the call.
- Emotion (`happy` / `surprised` / `sad` / `angry` / `neutral`) is
  picked from MediaPipe's facial-blendshape scores, with a short
  hysteresis so the emoji doesn't flicker on borderline expressions.
- Adaptive video quality watches round-trip time and packet loss every
  couple of seconds and steps the encoder between HD / SD / Low tiers
  without dropping the call.
- Same signaling backend as Retro, joined anonymously — the server hands
  out short-lived TURN credentials with a tighter relay window for
  unauthenticated sessions. Once the call is up, audio and video flow
  peer-to-peer over WebRTC.

**Stack:** `@mediapipe/tasks-vision` (FaceLandmarker, GPU delegate with
WASM fallback) loaded lazily from CDN; native `RTCPeerConnection` with
perfect negotiation; `canvas.captureStream` for output compositing;
`socket.io-client` against
[`apps/communication`](../../../../communication/README.md) for signaling.
