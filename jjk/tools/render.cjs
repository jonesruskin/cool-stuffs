// Full render: shots are distributed across N headless pages; each shot's frames are grabbed as
// PNG straight from the compositor canvas and piped into its own ffmpeg segment (no frames on disk).
//   node tools/render.cjs [--from shotIndex --to shotIndex]   -> build/seg/sNN.mp4 + build/film_video.mp4
const { serve, launch } = require('./serve.cjs');
const path = require('path'), fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const FF = process.env.FFMPEG || 'ffmpeg';
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'seg');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'build_meta.json')));
  const FPS = meta.FPS;
  const shots = meta.shots.map((s, i) => ({ i, name: s[0], f0: Math.round(s[1] * FPS), f1: Math.round(s[2] * FPS) }));
  const args = process.argv.slice(2);
  const from = args.includes('--from') ? +args[args.indexOf('--from') + 1] : 0;
  const to = args.includes('--to') ? +args[args.indexOf('--to') + 1] : shots.length - 1;
  const todo = shots.filter(s => s.i >= from && s.i <= to && !(process.env.SKIP_DONE && fs.existsSync(path.join(OUT, `s${String(s.i).padStart(2, '0')}.mp4`))));
  todo.sort((a, b) => (b.f1 - b.f0) - (a.f1 - a.f0));          // longest first for balance
  const W = +(process.env.WORKERS || 4);
  const srv = await serve(); const b = await launch();
  const t0 = Date.now(); let doneF = 0; const total = todo.reduce((a, s) => a + s.f1 - s.f0, 0);
  const queue = todo.slice();
  await Promise.all(Array.from({ length: W }, async () => {
    const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', e => console.log('[err]', e.message));
    page.on('console', m => { const t = m.text(); if (/error|Error/.test(t) && !/THREE\./.test(t)) console.log('[page]', t.slice(0, 200)); });
    await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
    await page.waitForFunction(() => window.READY === true, null, { timeout: 300000 });
    while (queue.length) {
      const s = queue.shift();
      const file = path.join(OUT, `s${String(s.i).padStart(2, '0')}.mp4`);
      const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', file], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let f = s.f0; f < s.f1; f++) {
        try { await page.evaluate(f => window.drawFrame(f), f); } catch (e) { console.log('ERR frame', f, e.message.split('\n')[0]); }
        const url = await page.evaluate(() => window.grabFrame('image/png'));
        const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        doneF++;
      }
      ff.stdin.end(); await new Promise(r => ff.on('close', r));
      const el = (Date.now() - t0) / 1000;
      console.log(`shot ${s.i} ${s.name} done  ${doneF}/${total} frames  ${el.toFixed(0)}s  eta ${(el / doneF * (total - doneF) / 60).toFixed(1)} min`);
    }
    await page.close();
  }));
  await b.close(); srv.close();
  // concat all 61 segments in order
  const list = shots.map(s => `file '${path.join(OUT, `s${String(s.i).padStart(2, '0')}.mp4`)}'`).join('\n');
  if (shots.every(s => fs.existsSync(path.join(OUT, `s${String(s.i).padStart(2, '0')}.mp4`)))) {
    fs.writeFileSync(path.join(OUT, 'list.txt'), list);
    execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'list.txt'), '-c', 'copy', path.join(ROOT, 'build', 'film_video.mp4')], { stdio: 'inherit' });
    console.log('wrote build/film_video.mp4');
  }
})().catch(e => { console.error(e); process.exit(1); });
