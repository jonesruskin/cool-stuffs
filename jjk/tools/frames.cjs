// node tools/frames.cjs out_dir f1,f2,...   -> renders frames (parallel pages) to JPEGs for review
const { serve, launch } = require('./serve.cjs');
const path = require('path'), fs = require('fs');
(async () => {
  const [out, list] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const frames = list.split(',').map(Number);
  const W = Math.min(+(process.env.WORKERS || 4), frames.length);
  const srv = await serve(); const b = await launch();
  await Promise.all(Array.from({ length: W }, async (_, w) => {
    const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', m => { const t = m.text(); if (!/THREE\./.test(t)) console.log('[page]', t.slice(0, 300)); });
    page.on('pageerror', e => console.log('[err]', e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
    await page.waitForFunction(() => window.READY === true, null, { timeout: 300000 });
    for (let i = w; i < frames.length; i += W) {
      const f = frames[i]; const t0 = Date.now();
      try { await page.evaluate(f => window.drawFrame(f), f); } catch (e) { console.log('ERR frame', f, e.message.split('\n').slice(0, 3).join(' | ')); continue; }
      const url = await page.evaluate(() => window.grabFrame('image/jpeg', .9));
      fs.writeFileSync(path.join(out, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
      console.log('frame', f, Date.now() - t0, 'ms');
    }
  }));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
