/**
 * Keeps recoverable diagnostics available during development without exposing
 * exception details through release-build console output.
 */
export function reportRecoverableIssue(context: string, error?: unknown): void {
  if (__DEV__) {
    console.error(context, error);
  }
}
