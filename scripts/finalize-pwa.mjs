/**
 * Stamp the static PWA service worker with a unique build id and the
 * hashed Next.js assets. Run after `next build` on GitHub Pages.
 * It caches only public interface assets, never Supabase/API responses.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const OUT = 'out'
const ROOT = '/traductor/'
const ROOT_FILES = [
  'index.html', 'manifest.webmanifest', 'icon-192.png',
  'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'icon.svg'
]
function walk(dir) {
  const entries = []
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name)
    if (item.isDirectory()) entries.push(...walk(path))
    else if (item.isFile() && /\.(js|css|woff2?|png|svg)$/.test(item.name)) entries.push(path)
  }
  return entries
}
for (const file of ROOT_FILES) {
  if (!statSync(join(OUT, file)).isFile()) throw new Error('PWA missing asset: ' + file)
}
const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.webmanifest'), 'utf8'))
if (manifest.start_url !== ROOT || manifest.scope !== ROOT ||
    manifest.display !== 'standalone') throw new Error('PWA manifest scope mismatch')
for (const icon of manifest.icons) {
  if (!icon.src.startsWith(ROOT) || icon.type !== 'image/png') {
    throw new Error('PWA icon is not scoped to GitHub Pages')
  }
  const bytes = readFileSync(join(OUT, icon.src.slice(ROOT.length)))
  if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error('Invalid PNG: ' + icon.src)
  }
  const [width, height] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
  if (icon.sizes !== width + 'x' + height) throw new Error('PWA icon size mismatch')
}
const precache = [
  ROOT,
  ...ROOT_FILES.filter(f => f !== 'index.html').map(f => ROOT + f),
  ...walk(join(OUT, '_next', 'static'))
    .map(p => ROOT + relative(OUT, p).split(sep).join('/'))
]
const file = join(OUT, 'sw.js')
let sw = readFileSync(file, 'utf8')
if (!sw.includes('__PAROLE_BUILD_TAG__') || !sw.includes('__PAROLE_PRECACHE_URLS__')) {
  throw new Error('Service worker template not found')
}
const hash = (process.env.GITHUB_SHA || 'local-' + Date.now()).replace(/[^\w-]/g, '').slice(0, 48)
sw = sw.replace('__PAROLE_BUILD_TAG__', hash)
  .replace('__PAROLE_PRECACHE_URLS__', JSON.stringify([...new Set(precache)]))
writeFileSync(file, sw)
const html = readFileSync(join(OUT, 'index.html'), 'utf8')
if (!html.includes('/traductor/manifest.webmanifest')) {
  throw new Error('Static HTML does not link the PWA manifest')
}
console.log('PWA ready: ' + precache.length + ' public assets; cache version ' + hash)
