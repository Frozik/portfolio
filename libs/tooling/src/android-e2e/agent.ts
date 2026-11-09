/** The port the agent serves on the phone, forwarded to the same port here by the runner script. */
const AGENT_URL = 'http://127.0.0.1:8642/';
/** The agent answers in tens of milliseconds; a request this slow means it is gone. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Where an element is on screen, in pixels; `whole` when none of it is cut off. */
export interface IPlace {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly whole: boolean;
  /** A disabled button is on screen but not yet for tapping. */
  readonly enabled: boolean;
  /** A switch or a checkbox that is on. */
  readonly checked: boolean;
}

interface IAnswer {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

/** One command to the e2e agent on the phone (libs/tooling/android-agent). */
async function agent(command: Readonly<Record<string, unknown>>): Promise<unknown> {
  const response = await fetch(AGENT_URL, {
    method: 'POST',
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const answer = (await response.json()) as IAnswer;
  if (!answer.ok) {
    throw new Error(
      `The e2e agent refused «${String(command['name'])}»: ${answer.error ?? 'no reason'}`
    );
  }
  return answer.result;
}

/** Where an element is, by its `testID` or another app's full resource id; `null` while absent. */
export async function locate(id: string): Promise<IPlace | null> {
  return (await agent({ name: 'locate', id })) as IPlace | null;
}

/** The view tree as `uiautomator dump` writes it, for a failed test's evidence. */
export async function dumpViewTree(): Promise<string> {
  return String(await agent({ name: 'dump' }));
}

/** Sets a field's text through accessibility: at once, and no keyboard opens. */
export async function setText(id: string, text: string): Promise<void> {
  await agent({ name: 'setText', id, text });
}
