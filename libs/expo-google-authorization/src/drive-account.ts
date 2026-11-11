import { z } from 'zod';

const DRIVE_ABOUT = z.object({ user: z.object({ emailAddress: z.string() }) });
const ABOUT_USER = 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)';

/** Google does not always name the account an authorization was given with; Drive does. */
export async function driveAccountOf(token: string): Promise<string | null> {
  try {
    const response = await fetch(ABOUT_USER, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      return null;
    }
    const about = DRIVE_ABOUT.safeParse(await response.json());
    return about.success ? about.data.user.emailAddress : null;
  } catch {
    // No network or no JSON: the account is shown without its address, nothing else depends on it.
    return null;
  }
}
