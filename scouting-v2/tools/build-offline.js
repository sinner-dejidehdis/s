// Builds rebuilt-scout-v2-offline.html: the whole app in one file that works with no network.
// Run: node scouting-v2/tools/build-offline.js   (add --check to fail if the committed file is stale)
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'rebuilt-scout-v2-offline.html');

function build() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // Web fonts, manifest and service worker need a server; the file falls back to system fonts.
  html = html.replace(/\s*<link rel="(preconnect|manifest)"[^>]*>/g, '');
  html = html.replace(/\s*<link rel="stylesheet" href="https:[^>]*>/g, '');
  html = html.replace(/<link rel="icon" href="icon.svg"[^>]*>/,
    '<link rel="icon" href="data:image/svg+xml;base64,' + Buffer.from(read('icon.svg')).toString('base64') + '">');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => '<style>\n' + read(href) + '</style>');
  let first = true;
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
    const flag = first ? '<script>var V2 = (globalThis.V2 = globalThis.V2 || {}); V2.OFFLINE_BUILD = true;</script>\n  ' : '';
    first = false;
    return flag + '<script>\n' + read(src).replace(/<\/script/gi, '<\\/script') + '\n</script>';
  });
  return html;
}

if (require.main === module) {
  const html = build();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== html) {
      console.error('rebuilt-scout-v2-offline.html is out of date: run node scouting-v2/tools/build-offline.js');
      process.exit(1);
    }
    console.log('offline file is up to date');
  } else {
    fs.writeFileSync(OUT, html);
    console.log('wrote ' + path.relative(process.cwd(), OUT) + ' (' + Math.round(html.length / 1024) + ' KB)');
  }
}
module.exports = { build };
