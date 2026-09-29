// node tools/plates.cjs OUTDIR [shotIds]  -> OUTDIR/<id>/0000.png ... + OUTDIR/<id>.json (bone screen positions)
const { serve, launch } = require('./serve.cjs');
const fs = require('fs'), path = require('path');
(async () => {
  const [out, only] = process.argv.slice(2);
  const srv = await serve(); const b = await launch();
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.log('[err]', e.message)); page.on('console', m => { if (/BOOT|rror/.test(m.text())) console.log('[page]', m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/plate.html`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 300000 });
  const list = await page.evaluate(() => window.shotList());
  for (const [id, dur] of Object.entries(list)) {
    if (only && !only.split(',').includes(id)) continue;
    const dir = path.join(out, id); fs.mkdirSync(dir, { recursive: true });
    await page.evaluate(id => window.startShot(id), id);
    const track = [];
    for (let f = 0; f < dur; f++) {
      const r = await page.evaluate(([id, f]) => window.plateFrame(id, f), [id, f]);
      fs.writeFileSync(path.join(dir, String(f).padStart(4, '0') + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
      track.push(r.pts);
    }
    fs.writeFileSync(path.join(out, id + '.json'), JSON.stringify(track));
    console.log(id, dur, 'frames');
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
