import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Password123!';
export const uniq = () => Math.random().toString(36).slice(2, 8);

export interface Account {
  name: string;
  email: string;
}

export const newAccount = (prefix: string): Account => {
  const id = uniq();
  return { name: `${prefix} ${id}`.slice(0, 30), email: `${prefix}.${id}@e2e.local` };
};

export const register = async (page: Page, account: Account) => {
  await page.goto('/register');
  await page.getByLabel('Display name').fill(account.name);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
};

export const logout = async (page: Page) => {
  await page.getByTitle('Log out').click();
  await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
};
