// Deterministic frame renderer: serves this folder, drives reel.js frame by frame in
// headless Chromium (4 parallel pages), writes PNGs, then muxes with the soundtrack.
//
//   node render.cjs                 -> build/claude-motion-reel.mp4
//   node render.cjs --stills 1.2,5  -> build/stills/t1.2.png ...
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'build');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.wav': 'audio/wav' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', e));
  page.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html?render`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });
  return page;
}

async function shot(page, frame, file, sub) {
  await page.evaluate(([f, s]) => window.drawFrame(f, s), [frame, sub]);
  await page.locator('#c').screenshot({ path: file, type: 'png' });
}

(async () => {
  const args = process.argv.slice(2);
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const sub = Number((args.find(a => a.startsWith('--sub=')) || '--sub=6').split('=')[1]);

  if (args[0] === '--stills') {
    fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
    const page = await openPage(browser, port);
    for (const s of args[1].split(',')) {
      const f = Math.round(parseFloat(s) * 60);
      await shot(page, f, path.join(OUT, 'stills', `t${s}.png`), sub);
    }
    console.log('stills done');
  } else {
    const frames = 900, workers = Number(process.env.WORKERS || 4);
    const dir = path.join(OUT, 'frames');
    // FRAMES=a-b re-renders only that range and keeps the rest of the cached frames
    const [fa, fb] = process.env.FRAMES ? process.env.FRAMES.split('-').map(Number) : [0, frames - 1];
    if (!process.env.FRAMES) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    let done = 0;
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const page = await openPage(browser, port);
      for (let f = fa + w; f <= fb; f += workers) {
        await shot(page, f, path.join(dir, `f${String(f).padStart(4, '0')}.png`), sub);
        if (++done % 60 === 0) console.log(`${done}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    }));
    const ff = process.env.FFMPEG || 'ffmpeg';
    const mp4 = path.join(OUT, 'claude-motion-reel.mp4');
    execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', '60', '-i', path.join(dir, 'f%04d.png'), '-i', path.join(ROOT, 'assets', 'music.wav'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-tune', 'film', '-pix_fmt', 'yuv420p',
      '-profile:v', 'high', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    console.log('wrote', mp4, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
