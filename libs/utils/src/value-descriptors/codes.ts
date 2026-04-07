export enum EValueDescriptorErrorCode {
  // 1	The operation was cancelled, typically by the caller.
  CANCELLED = 'CANCELLED',
  // 2	Unknown error.
  UNKNOWN = 'UNKNOWN',
  // 3	The client specified an invalid argument.
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  // 4	The deadline expired before the operation could complete.
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',
  // 5	Some requested entity was not found.
  NOT_FOUND = 'NOT_FOUND',
  // 6	The entity that a client attempted to create already exists.
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  // 7	The caller does not have permission to execute the specified operation.
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  // 8	Some resource has been exhausted.
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  // 9	The operation was rejected because the system is not in a state required for the operation's execution.
  FAILED_PRECONDITION = 'FAILED_PRECONDITION',
  // 10	The operation was aborted, typically due to a concurrency issue.
  ABORTED = 'ABORTED',
  // 11	The operation was attempted past the valid range.
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  // 12	The operation is not implemented or is not supported/enabled in this service.
  UNIMPLEMENTED = 'UNIMPLEMENTED',
  // 13	Internal errors.
  INTERNAL = 'INTERNAL',
  // 14	The service is currently unavailable.
  UNAVAILABLE = 'UNAVAILABLE',
  // 15	Unrecoverable data loss or corruption.
  DATA_LOSS = 'DATA_LOSS',
  // 16	The request does not have valid authentication credentials for the operation.
  UNAUTHENTICATED = 'UNAUTHENTICATED',
}
