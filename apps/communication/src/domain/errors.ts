// Typed protocol errors. Each carries a stable `code` (string-literal) that
// is forwarded to clients via `toClientPayload`.

export class RoomFullError extends Error {
  public readonly code = 'room/full' as const;
  public constructor(message = 'room is at capacity') {
    super(message);
    this.name = 'RoomFullError';
  }
  public toClientPayload(): { code: string } {
    return { code: this.code };
  }
}

export class TooManyTabsError extends Error {
  public readonly code = 'room/too-many-tabs' as const;
  public constructor(message = 'user has too many tabs in this room') {
    super(message);
    this.name = 'TooManyTabsError';
  }
  public toClientPayload(): { code: string } {
    return { code: this.code };
  }
}

export class InvalidPayloadError extends Error {
  public readonly code = 'payload/invalid' as const;
  public constructor(message = 'payload is invalid') {
    super(message);
    this.name = 'InvalidPayloadError';
  }
  public toClientPayload(): { code: string } {
    return { code: this.code };
  }
}

export class InvalidTokenError extends Error {
  public readonly code = 'auth/invalid-token' as const;
  public constructor(message = 'token is invalid') {
    super(message);
    this.name = 'InvalidTokenError';
  }
  public toClientPayload(): { code: string } {
    return { code: this.code };
  }
}

export class TokenExpiredError extends Error {
  public readonly code = 'auth/expired-token' as const;
  public constructor(message = 'token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
  public toClientPayload(): { code: string } {
    return { code: this.code };
  }
}

export class JwksUnreachableError extends Error {
  public readonly code = 'auth/jwks-unreachable' as const;
  public constructor(message = 'unable to reach JWKS endpoint') {
    super(message);
    this.name = 'JwksUnreachableError';
  }
  public toClientPayload(): { code: string } {
    return { code: this.code };
  }
}

export class RateLimitedError extends Error {
  public readonly code = 'rate-limited' as const;
  public constructor(message = 'rate limit exceeded') {
    super(message);
    this.name = 'RateLimitedError';
  }
  public toClientPayload(): { code: string } {
    return { code: this.code };
  }
}
