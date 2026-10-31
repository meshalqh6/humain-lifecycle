import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const secret=readFileSync(resolve('../.env'),'utf8').split(/\r?\n/).find(x=>x.startsWith('ADMIN_PASSWORD=')).slice('ADMIN_PASSWORD='.length);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const login=await context.request.post('http://127.0.0.1:5173/api/auth/login',{headers:{'X-Humain-Request':'1'},data:{username:'admin',password:secret}});
 if(!login.ok())throw new Error('Local sign-in failed');
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');
 await page.locator('.metric').first().waitFor();
 await page.screenshot({path:'../docs/screenshots/development-overview.png',fullPage:true,animations:"disabled"});
 await page.goto('http://127.0.0.1:5173/chat');
 await page.locator('.composer-bottom .live-dot, .composer-bottom .offline-dot').waitFor();
 await page.screenshot({path:'../docs/screenshots/development-wasl.png',fullPage:true,animations:"disabled"});
 for (const [route,selector] of [['settings','.integration-card'],['integrations','.integration-card'],['employees','tbody tr'],['contracts','.upload-zone'],['onboarding','.workflow-card'],['compliance','.info-strip'],['communications','.template-card'],['analytics','.recharts-surface'],['audit','tbody tr']]) {
  await page.goto('http://127.0.0.1:5173/'+route);
  await page.locator(selector).first().waitFor();
  if(route === "settings") await page.getByRole("button",{name:"Save email settings"}).waitFor();
  if(route === "settings" || route === "integrations") await page.locator('.integration-grid[aria-busy="false"]').waitFor();
  await page.screenshot({path:'../docs/screenshots/development-'+route+'.png',fullPage:true,animations:"disabled"});
 }
 if(errors.length)throw new Error(errors.join('; '));
 console.log('Development screenshots saved; no page exceptions.');
} finally { await browser.close(); }
