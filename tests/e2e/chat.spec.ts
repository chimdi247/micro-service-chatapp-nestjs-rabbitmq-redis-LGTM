import { expect, test } from '@playwright/test';

import { newAccount, register } from './helpers';

test('two users chat in real time (RabbitMQ user sync + MongoDB messages)', async ({ browser }) => {
  const alice = newAccount('alice');
  const bob = newAccount('bob');

  const aliceCtx = await browser.newContext();
  const bobCtx = await browser.newContext();
  const alicePage = await aliceCtx.newPage();
  const bobPage = await bobCtx.newPage();

  await register(bobPage, bob);
  await register(alicePage, alice);

  // Start a conversation with Bob (he becomes searchable once auth.user.registered is consumed).
  await alicePage.getByTitle('New conversation').click();
  const search = alicePage.getByPlaceholder('Type at least 3 characters...');
  await expect(async () => {
    await search.fill('');
    await search.fill(bob.name.slice(0, 8));
    await expect(alicePage.getByText(bob.email)).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 45_000 });
  await alicePage.getByText(bob.email).click();
  await alicePage.getByRole('button', { name: 'Start conversation' }).click();

  const message = `hello from playwright ${Date.now()}`;
  const composer = alicePage.getByPlaceholder('Type a message...');
  await composer.fill(message);
  await composer.press('Enter');
  await expect(alicePage.getByText(message)).toBeVisible();

  // Bob sees the conversation and the message (polling/refresh in the client).
  await expect(async () => {
    await bobPage.reload();
    await bobPage.getByText(alice.name).first().click();
    await expect(bobPage.getByText(message)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 45_000 });

  await aliceCtx.close();
  await bobCtx.close();
});
