export const transportTranslationsEn = {
  kicker: 'transport / http3 · webtransport',
  headlinePrimary: 'One transport,',
  headlineAccent: 'HTTP/3 first, WebSocket when it must.',
  subtitle:
    'Connect RPC over WebTransport: JSON for messages, binary protobuf for bytes, one stream per call. When UDP is blocked the same calls ride a multiplexed WebSocket with the same flow control.',
  connection: {
    title: 'Connection',
    states: {
      idle: 'Not connected yet',
      connecting: 'Connecting…',
      open: (protocol: string) => `Open over ${protocol}`,
      failed: (reason: string) => `Failed: ${reason}`,
    },
    protocols: { http3: 'HTTP/3 (WebTransport)', websocket: 'WebSocket (fallback)' },
    modes: { auto: 'Auto', http3: 'HTTP/3 only', websocket: 'WebSocket only' },
    modeHint: 'Auto tries HTTP/3 first and falls back by itself; the others force one path.',
    wireFormats: { binary: 'BIN', json: 'JSON' },
    wireFormatHint:
      'BIN is protobuf. JSON is for debugging: calls that move no bytes go as JSON, and on the WebSocket every message but raw file bytes is readable text in DevTools.',
  },
  plot: {
    title: 'Plot a function',
    expression: 'f(x) =',
    expressionHint:
      'One variable x; + − * / ^, implicit products (2x, 3(x+1)), sin cos tan sqrt abs ln log exp, pi, e.',
    xMin: 'x from',
    xMax: 'to',
    submit: 'Plot',
    inputErrors: {
      'expression-empty': 'Type a function of x.',
      'expression-too-long': 'The expression is too long.',
      'invalid-range': 'The range must go from a smaller x to a larger one.',
    },
    expressionErrors: {
      empty: 'The expression is empty',
      'too-long': 'The expression is too long',
      'too-deep': 'Too many nested brackets',
      'unexpected-character': 'Unexpected character',
      'invalid-number': 'Not a valid number',
      'unknown-identifier': 'Unknown name',
      'unexpected-token': 'Did not expect this here',
      'unexpected-end': 'The expression ends too early',
      unknown: 'The server could not read it',
    },
    waiting: 'Asking the server for the visible window…',
    lastSample: (points: number, ms: number) =>
      `last window: ${points} points in ${Math.round(ms)} ms`,
    navigationHint:
      'Wheel or pinch to zoom, drag to pan: each new window is sampled again, one point per 10 physical pixels.',
    chartLabel: 'Plot of the sampled function',
  },
  echo: {
    title: 'File echo',
    description:
      'The file goes to the server and straight back into a file you choose. Nothing is stored: the server holds one chunk at a time, and a slow disk slows the upload.',
    pick: 'File to echo',
    start: 'Start the echo',
    cancel: 'Cancel',
    limits: (maxBytes: string, rate: string) => `Up to ${maxBytes}, at most ${rate}`,
    sent: 'Sent',
    received: 'Received',
    speed: 'Speed',
    strategy: {
      'file-system-access': 'saving through the file dialog',
      'stream-saver': 'saving as a streamed download',
      'blob-download': 'saving as a download',
    },
    tooLarge: (size: string, limit: string) => `The file is ${size}; the limit is ${limit}.`,
    noStreamingSave:
      'This browser can only save a file it holds whole in memory, which the echo refuses to do. Try a Chromium browser, or allow service workers.',
    cancelled: 'Cancelled.',
    results: 'Finished echoes',
    columns: {
      protocol: 'Protocol',
      size: 'File size',
      speed: 'Speed',
      verdict: 'Check',
    },
    verdictShort: {
      intact: 'Intact',
      'size-mismatch': 'Size differs',
      'checksum-mismatch': 'Bytes changed',
    },
    unknownProtocol: 'transport unknown (the session had dropped)',
  },
  failures: {
    trace: {
      label: 'Trace ID',
      copy: 'Copy the trace ID',
      copied: 'Copied',
      copyFailed: 'Could not copy',
    },
    refused: (message: string) => `Refused: ${message}`,
    quota: (message: string) => `Over the limit: ${message}`,
    unreachable: (message: string) =>
      message === '' ? 'No answer from the server.' : `No answer: ${message}`,
  },
};
