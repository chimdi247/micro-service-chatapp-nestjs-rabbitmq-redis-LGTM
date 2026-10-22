import { expect, test } from '@playwright/test';

test('login page renders and protected route redirects', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  await page.goto('/chat');
  await expect(page).toHaveURL(/login/);
});
