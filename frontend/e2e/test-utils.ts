import { type BrowserContext } from '@playwright/test';

const PASSWORD = 'Password123';

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
}

export const sessions = new Map<string, StoredCookie[]>();

export async function loginOnce(context: BrowserContext, email: string): Promise<void> {
  if (sessions.has(email)) return;

  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });

  const cookies = await context.cookies();
  sessions.set(email, cookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    httpOnly: c.httpOnly ?? false,
  })));
  await page.close();
}

export async function restoreSession(context: BrowserContext, email: string): Promise<void> {
  const cookies = sessions.get(email);
  if (cookies) {
    await context.addCookies(cookies);
  }
}
