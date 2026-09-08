export class PeopleHubError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'PEOPLEHUB_ERROR',
  ) {
    super(message);
    this.name = 'PeopleHubError';
  }
}

export class AuthRequiredError extends PeopleHubError {
  constructor(message = 'Sesión expirada. Ejecutá peoplehub_login e iniciá sesión con Microsoft.') {
    super(message, 'AUTH_REQUIRED');
    this.name = 'AuthRequiredError';
  }
}

export function formatErrorForMcp(err: unknown): string {
  if (err instanceof PeopleHubError) {
    return `[${err.code}] ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
