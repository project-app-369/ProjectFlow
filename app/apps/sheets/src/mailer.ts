/** Sends plain-text email. the deployed backend has no mail transport yet; the simulator logs; tests keep what was sent. */
export interface Mailer {
  send(to: string[], subject: string, body: string): void;
}

/** Does nothing: the default when no mail service is wired in. */
export const noMailer: Mailer = { send() { /* no mail service */ } };

/** Keeps every message, for tests and the local simulator. */
export class MemoryMailer implements Mailer {
  readonly sent: { to: string[]; subject: string; body: string }[] = [];
  send(to: string[], subject: string, body: string) { this.sent.push({ to, subject, body }); }
}
