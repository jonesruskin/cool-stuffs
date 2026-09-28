// node tools/still.cjs page.html out.png [w h] [evalExpr]  -> screenshot a page once window.READY
const { serve, launch } = require('./serve.cjs');
(async () => {
  const [pg, out, w = 1280, h = 720, expr] = process.argv.slice(2);
  const srv = await serve(); const b = await launch();
  const page = await b.newPage({ viewport: { width: +w, height: +h } });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${srv.address().port}/${pg}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  if (expr) await page.evaluate(expr);
  await page.screenshot({ path: out });
  console.log('shot', out, Date.now() - t0, 'ms');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
