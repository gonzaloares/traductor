/**
 * Generate Parole's installable app icons with Node built-ins only.
 * This keeps GitHub Pages builds reproducible without external image tools.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUTPUT = 'public'
mkdirSync(OUTPUT, { recursive: true })

const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c >>> 0
}
function crc32(data) {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type)
  const body = Buffer.concat([name, data])
  const output = Buffer.alloc(body.length + 8)
  output.writeUInt32BE(data.length, 0)
  body.copy(output, 4)
  output.writeUInt32BE(crc32(body), 4 + body.length)
  return output
}
function roundedBackground(x, y, maskable) {
  if (maskable) return true
  const r = 96
  const dx = Math.max(Math.abs(x - 256) - (256 - r), 0)
  const dy = Math.max(Math.abs(y - 256) - (256 - r), 0)
  return dx * dx + dy * dy < r * r
}
function paint(x, y, maskable) {
  if (!roundedBackground(x, y, maskable)) return [0, 0, 0, 0]
  const t = Math.min(1, Math.max(0, (x * 0.6 + y * 0.4) / 512))
  let r = 99 * (1 - t) + 55 * t
  let g = 102 * (1 - t) + 48 * t
  let b = 241 * (1 - t) + 163 * t
  const stem = x > 147 && x < 205 && y > 148 && y < 387
  const outer = ((x - 260) / 126) ** 2 + ((y - 229) / 109) ** 2 < 1
  const inner = ((x - 267) / 66) ** 2 + ((y - 224) / 51) ** 2 < 1
  if (stem || (outer && !inner)) [r, g, b] = [255, 255, 255]
  if ((x - 369) ** 2 + (y - 376) ** 2 < 34 ** 2) [r, g, b] = [94, 234, 212]
  return [r, g, b, 255]
}
function png(size, maskable = false) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const sample = 2
  for (let y = 0; y < size; y++) {
    const start = y * (size * 4 + 1)
    raw[start] = 0
    for (let x = 0; x < size; x++) {
      const pixel = [0, 0, 0, 0]
      for (let sy = 0; sy < sample; sy++) {
        for (let sx = 0; sx < sample; sx++) {
          const px = (x + (sx + 0.5) / sample) * 512 / size
          const py = (y + (sy + 0.5) / sample) * 512 / size
          const value = paint(px, py, maskable)
          for (let k = 0; k < 4; k++) pixel[k] += value[k]
        }
      }
      const offset = start + 1 + x * 4
      for (let k = 0; k < 4; k++) raw[offset + k] = Math.round(pixel[k] / (sample * sample))
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ])
}
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon.png', 64, false]
]) {
  writeFileSync(join(OUTPUT, name), png(size, maskable))
  console.log('Created ' + name)
}
