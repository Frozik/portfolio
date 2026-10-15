/**
 * The class the bug reporter hides whole during a capture
 * (`@frozik/bug-reporter` core/sensitive.ts): every node that can show a
 * secret carries it. A contract by name, so the vault does not import the reporter.
 */
export const SENSITIVE_CLASS = 'bug-block';
