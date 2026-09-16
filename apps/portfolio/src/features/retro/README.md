# Retro

A peer-to-peer retrospective board: CRDT state synced browser to browser over WebRTC, no database.

Live: [https://frozik.github.io/portfolio/retro](https://frozik.github.io/portfolio/retro) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/retro/`.

Collaborative retrospective board for Agile teams. Sign in with Google or
Yandex, create a board, share the link — participants sync in real time
directly between browsers, with no central database holding the data.

**Lobby** (`/retro`) — list of locally stored retros (name, creation date,
participant count) plus Create and Join-by-link actions. The default
nickname is seeded from your sign-in profile; sign-out is a click away.

**Room** (`/retro/:uuid`) — a columns board driven by the selected template:
the classic Scrum three-column format (Went Well / To Improve / Action
Items), in English or Russian. Cards added during Brainstorm render face-down
(hidden until reveal) with a 3D flip animation that stagger-flips on phase
advance to Group. Only the retro organizer (facilitator) can advance phases
and control the shared timer.

**Behind the scenes:**
- Each participant's IndexedDB is the source of truth — retros sync
  directly between browsers over WebRTC, and the underlying CRDT
  guarantees both sides converge to the same state regardless of message
  order or temporary disconnects
- A small backend service handles only the initial peer-to-peer
  handshake and hands out short-lived TURN credentials for NAT
  traversal; once two browsers connect, retro data flows directly
  between them and the server is no longer in the loop
- Sign-in is Google or Yandex (the user picks the provider on the
  sign-in screen); the session token lives only in `sessionStorage`,
  so closing the tab fully signs the user out

**Stack:** `yjs`, `y-indexeddb`, `y-webrtc` for CRDT storage and P2P
sync; `@dnd-kit/*` for accessible drag-and-drop; pluggable sign-in
abstraction (`IOidcProvider`) with Google and Yandex strategies;
MobX facade (`RoomStore`, `RetroLobbyStore`, `IdentityStore`) wraps
Yjs so presentation stays library-agnostic. The signaling backend
([`apps/communication`](../../../../communication/README.md)) is a Fastify 5
+ Socket.IO 4 server with a `coturn` TURN sidecar, deployed on a single
Ubuntu VPS.
