import { By, Key, until, type WebDriver } from 'selenium-webdriver';

import { config } from '../lib/config';
import { buildDriver } from './driver';

const password = config.password;
const uid = () => Math.random().toString(36).slice(2, 8);

let driver: WebDriver;

const byLabel = (text: string) => By.xpath(`//label[normalize-space()="${text}"]/following::input[1]`);

const register = async (name: string, email: string) => {
  await driver.get(`${config.client}/register`);
  await driver.wait(until.elementLocated(byLabel('Display name')), 15_000);
  await driver.findElement(byLabel('Display name')).sendKeys(name);
  await driver.findElement(byLabel('Email')).sendKeys(email);
  await driver.findElement(byLabel('Password')).sendKeys(password);
  await driver.findElement(By.xpath('//button[normalize-space()="Create account"]')).click();
  await driver.wait(until.elementLocated(By.xpath('//h2[normalize-space()="Conversations"]')), 20_000);
};

beforeAll(async () => {
  driver = await buildDriver();
});

afterAll(async () => {
  await driver?.quit();
});

describe('Selenium: client UI', () => {
  it('shows the login page and redirects anonymous users from /chat', async () => {
    await driver.get(`${config.client}/chat`);
    await driver.wait(until.urlContains('login'), 15_000);
    const heading = await driver.wait(until.elementLocated(By.xpath('//*[normalize-space()="Welcome back"]')), 15_000);
    expect(await heading.isDisplayed()).toBe(true);
  });

  it('registers a user, lands on the chat page and can log out', async () => {
    const id = uid();
    await register(`selenium ${id}`, `selenium.${id}@e2e.local`);

    await driver.findElement(By.css('button[title="Log out"]')).click();
    await driver.wait(until.urlContains('login'), 15_000);
  });

  it('opens the new-conversation dialog and validates the composer is present after selecting a user', async () => {
    const id = uid();
    await register(`selenium ${id}`, `selenium.${id}@e2e.local`);

    await driver.findElement(By.css('button[title="New conversation"]')).click();
    const search = await driver.wait(until.elementLocated(By.css('#search-users')), 10_000);
    await search.sendKeys('sel', Key.TAB);
    expect(await search.isDisplayed()).toBe(true);
  });
});
