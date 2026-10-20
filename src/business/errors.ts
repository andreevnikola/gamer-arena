export type DomainErrorCode =
  | "validation"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_state";

/** Expected rule violation. Presentation maps `code` to an HTTP status / UI message. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type Clock = () => Date;
