const assert = require('node:assert/strict');
const { chromium } = require('../../deployment/runtime-test/browser-check/node_modules/playwright-core');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
 try {
  let phase = 'initial'; const events=[];
  const pages = await Promise.all([browser.newPage(), browser.newPage()]);
  for (const page of pages) {
   page.on('response', r => { if(r.url().includes('/website/translate')) events.push({phase,status:r.status()}); });
   await page.addInitScript(()=>localStorage.setItem('apakhabar-language','en'));
  }
  async function settle(page) {
   await page.waitForTimeout(450);
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-no-translate] [role="status"]')].every(e=>!e.textContent.trim()), {}, {timeout:120000});
   await page.waitForLoadState('networkidle');
  }
  await Promise.all(pages.map(p=>p.goto('http://localhost:8088/news/14', {waitUntil:'domcontentloaded'})));
  await Promise.all(pages.map(settle));
  assert(events.length > 0); assert(events.every(e=>e.status===200),JSON.stringify(events));
  phase='cold-concurrent';
  const text = 'Pemerintah menyediakan buku baru untuk perpustakaan sekolah. Para siswa dan guru menyambut program pendidikan untuk masyarakat. '.repeat(6) + Date.now();
  const cold=await Promise.all(pages.map(page=>page.evaluate(async text=>{
   const r=await fetch('/website/translate',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]').content},body:JSON.stringify({texts:[text],target:'en',source:'id'})});
   return {status:r.status,body:await r.json()};
  },text)));
  assert(cold.every(r=>r.status===200 && r.body.translations?.[0]),JSON.stringify(cold));
  assert.equal(cold[0].body.translations[0],cold[1].body.translations[0]);
  phase='switching';
  const page=pages[0];
  const en=await page.locator('.article-content').innerText();
  await page.getByRole('button',{name:'Ganti ke Bahasa Indonesia',exact:true}).first().click(); await settle(page);
  const id=await page.locator('.article-content').innerText();
  const before=events.length;
  await page.getByRole('button',{name:'Switch to English',exact:true}).first().click(); await settle(page);
  assert.equal(await page.locator('.article-content').innerText(),en);
  const switchBackRequests=events.length-before;
  assert.equal(switchBackRequests,0);
  phase='saved-ms';
  const stale=await browser.newPage(); await stale.addInitScript(()=>localStorage.setItem('apakhabar-language','ms'));
  await stale.goto('http://localhost:8088/news/14',{waitUntil:'domcontentloaded'}); await settle(stale);
  assert.equal(await stale.evaluate(()=>localStorage.getItem('apakhabar-language')),'id');
  phase='malay-rejected';
  const ms=await page.evaluate(async()=>{
   const r=await fetch('/website/translate',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','X-CSRF-TOKEN':document.querySelector('meta[name="csrf-token"]').content},body:JSON.stringify({texts:['Hello'],target:'ms'})}); return r.status;
  }); assert.equal(ms,422);
  phase='forced-outage'; let outageRequests=0;
  await page.route('**/website/translate',async route=>{outageRequests++; await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Translation is temporarily unavailable.'})});});
  const original='Laporan terbaru: sekolah menyediakan perpustakaan untuk siswa '+Date.now();
  await page.evaluate(text=>{const p=document.createElement('p');p.id='translation-failure-probe';p.lang='id';p.textContent=text;document.querySelector('main').append(p);},original);
  await page.waitForTimeout(1500);
  await page.evaluate(()=>document.querySelector('main').append(document.createElement('span'))); await page.waitForTimeout(1200);
  assert.equal(outageRequests,1);
  assert.equal(await page.locator('#translation-failure-probe').innerText(),original);
  assert.equal(await page.getByRole('button',{name:/^(Retry|Cuba lagi|Coba lagi)$/}).count(),0);
  assert.equal(await page.getByText(/Some text could not be translated|Sebahagian teks|Sebagian teks/).count(),0);
  console.log(JSON.stringify({events,coldConcurrentStatuses:cold.map(r=>r.status),sample:cold[0].body.translations[0].slice(0,130),articleChangesBetweenLanguages:en!==id,switchBackRequests,savedMSFallsBackToID:true,malayRejected:ms,failedRequests:outageRequests,originalPreserved:true,headerErrorsAbsent:true}));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});

