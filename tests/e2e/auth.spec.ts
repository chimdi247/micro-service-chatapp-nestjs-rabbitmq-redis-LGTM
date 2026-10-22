import { expect, test } from '@playwright/test';

import { PASSWORD, logout, newAccount, register } from './helpers';

test.describe('authentication', () => {
  test('register -> logout -> login', async ({ page }) => {
    const account = newAccount('auth');
    await register(page, account);
    await logout(page);

    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
  });

  test('wrong password is rejected', async ({ page }) => {
    const account = newAccount('bad');
    await register(page, account);
    await logout(page);

    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill('wrong-password-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conversations' })).toHaveCount(0);
  });
});
