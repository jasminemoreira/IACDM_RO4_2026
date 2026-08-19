/**
 * Gera os ícones do manifest (192×192 e 512×512) exigidos por REG-03.
 *
 * Plano de capacidade de P0: "ícone gerado por mim, sem dependência de terceiros,
 * sem questão de licença". O hanzi 中 é desenhado com retângulos — nenhuma fonte é
 * necessária, o que torna o resultado reproduzível em qualquer máquina.
 *
 * Uso: node tools/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BG = [0x14, 0x16, 0x1a, 0xff] // mesmo tom do tema escuro da UI
const FG = [0xf5, 0xf6, 0xf8, 0xff]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** Desenha 中: um retângulo vazado (口) com um traço vertical atravessando-o. */
function drawGlyph(size) {
  const px = (x, y) => (y * size + x) * 4
  const rgba = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) rgba.set(BG, i * 4)

  const fill = (x0, y0, x1, y1) => {
    for (let y = Math.max(0, y0 | 0); y < Math.min(size, y1 | 0); y++)
      for (let x = Math.max(0, x0 | 0); x < Math.min(size, x1 | 0); x++) rgba.set(FG, px(x, y))
  }

  const u = size / 32 // unidade de traço
  const boxL = 8 * u, boxR = 24 * u, boxT = 9 * u, boxB = 23 * u
  const t = 2 * u // espessura

  fill(boxL, boxT, boxR, boxT + t) // topo do 口
  fill(boxL, boxB - t, boxR, boxB) // base
  fill(boxL, boxT, boxL + t, boxB) // lateral esquerda
  fill(boxR - t, boxT, boxR, boxB) // lateral direita
  fill(16 * u - t / 2, 4 * u, 16 * u + t / 2, 28 * u) // traço vertical atravessando

  // scanlines com byte de filtro 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return raw
}

function png(size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(drawGlyph(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  const file = `public/icon-${size}.png`
  writeFileSync(file, png(size))
  console.log(`${file} — ${size}×${size}`)
}

writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" fill="#14161a"/>
  <g fill="#f5f6f8">
    <rect x="8" y="9" width="16" height="2"/>
    <rect x="8" y="21" width="16" height="2"/>
    <rect x="8" y="9" width="2" height="14"/>
    <rect x="22" y="9" width="2" height="14"/>
    <rect x="15" y="4" width="2" height="24"/>
  </g>
</svg>\n`,
)
console.log('public/icon.svg — fonte vetorial do mesmo desenho')
