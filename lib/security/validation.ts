export class InputValidationError extends Error {
  constructor(message = "Invalid request parameters.") {
    super(message);
    this.name = "InputValidationError";
  }
}

/** Mongo selectors must receive primitives, never caller-supplied query objects. */
export function assertQueryString(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 512 ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new InputValidationError();
}
