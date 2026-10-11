/** Only deliberate, user-actionable validation/conflict messages use this type.
 * Database, transport and other unexpected exceptions must reach apiHandler. */
export class WritingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "WritingError";
  }
}
