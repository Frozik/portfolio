import type { EValueDescriptorErrorCode } from '../codes';

export class ValueDescriptorError extends Error {
  constructor(
    message: string,
    public readonly code: EValueDescriptorErrorCode,
    public readonly description?: string
  ) {
    super(message);
  }
}
