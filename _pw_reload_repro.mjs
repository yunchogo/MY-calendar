import { chromium } from "playwright";

const shotDir = "C:\\Users\\user\\AppData\\Local\\Temp\\claude\\C--Users-user-bboggl\\41fd5fcf-85de-4e78-ac2c-46f34501a1dd\\scratchpad";
const email = "yunchogo0411+bbogglt27568_1098945416204000@gmail.com";
const password = "testpass123";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
await page.click("button:has-text('로그인')");
await page.waitForSelector("text=다시 만나서 반가워요", { timeout: 5000 });
await page.fill("input[placeholder='이메일']", email);
await page.fill("input[placeholder^='비밀번호']", password);
await page.click("button[type=submit]:has-text('로그인')");
await page.waitForTimeout(3000);

const firstLoad = await page.locator(".cell-holiday-label:has-text('제헌절')").count();
console.log("first_load_label=" + firstLoad);
await page.screenshot({ path: `${shotDir}\\a1_first_load.png` });

// Reload once
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const afterReload1 = await page.locator(".cell-holiday-label:has-text('제헌절')").count();
console.log("after_reload_1_label=" + afterReload1);
await page.screenshot({ path: `${shotDir}\\a2_after_reload1.png` });

// Reload again
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const afterReload2 = await page.locator(".cell-holiday-label:has-text('제헌절')").count();
console.log("after_reload_2_label=" + afterReload2);
await page.screenshot({ path: `${shotDir}\\a3_after_reload2.png` });

await browser.close();
