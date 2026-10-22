import { expect, test } from '@playwright/test';

const grafana = process.env.GRAFANA_URL ?? 'http://localhost:3001';
const user = process.env.GRAFANA_USER ?? 'admin';
const password = process.env.GRAFANA_PASSWORD ?? 'admin123';

test('Grafana: log in and open the overview dashboard with data panels', async ({ page }) => {
  await page.goto(`${grafana}/login`);
  await page.getByLabel(/email or username/i).fill(user);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();

  await page.goto(`${grafana}/d/chatapp-overview`);
  await expect(page.getByText('ChatApp - Overview (SLI / SLO / KPI)')).toBeVisible();
  await expect(page.getByText('Availability SLI')).toBeVisible();
  await expect(page.getByText('Successful (2xx/3xx)')).toBeVisible();
});

test('Grafana: datasources are healthy', async ({ request }) => {
  const auth = { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` };
  for (const uid of ['mimir', 'loki', 'tempo']) {
    const res = await request.get(`${grafana}/api/datasources/uid/${uid}/health`, { headers: auth });
    expect(res.ok(), `datasource ${uid}`).toBeTruthy();
  }
});
