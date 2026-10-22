import { Builder, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

/**
 * Local headless Chrome by default (Selenium Manager downloads the driver).
 * Set SELENIUM_REMOTE_URL to use a Grid / the compose "selenium" service.
 */
export const buildDriver = async (): Promise<WebDriver> => {
  const options = new chrome.Options();
  options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1400,900');

  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  if (process.env.SELENIUM_REMOTE_URL) {
    builder.usingServer(process.env.SELENIUM_REMOTE_URL);
  }
  return builder.build();
};
