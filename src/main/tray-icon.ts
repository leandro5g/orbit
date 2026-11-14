import { nativeImage, type NativeImage } from 'electron'

/**
 * Desenha o ✦ do Orbit em pixels (sem arquivo de imagem): estrela de 4 pontas |x|^½ + |y|^½ ≤ 1.
 * No macOS vira template image (preta + alfa) e o sistema ajusta para menu bar clara ou escura.
 */
export function orbitTrayIcon(): NativeImage {
  const isMac = process.platform === 'darwin'
  const scale = 2
  const size = 18 * scale
  const r = size * 0.44
  const c = size / 2
  const ss = 4 // supersampling por eixo
  const buf = Buffer.alloc(size * size * 4)
  // BGRA pré-multiplicado. Fora do mac: lavanda (#a78bfa) para aparecer em qualquer bandeja.
  const [b, g, rr] = isMac ? [0, 0, 0] : [250, 139, 167]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = Math.abs((x + (sx + 0.5) / ss - c) / r)
          const py = Math.abs((y + (sy + 0.5) / ss - c) / r)
          if (Math.sqrt(px) + Math.sqrt(py) <= 1) inside++
        }
      }
      const a = Math.round((inside / (ss * ss)) * 255)
      const i = (y * size + x) * 4
      buf[i] = Math.round((b * a) / 255)
      buf[i + 1] = Math.round((g * a) / 255)
      buf[i + 2] = Math.round((rr * a) / 255)
      buf[i + 3] = a
    }
  }
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: scale })
  if (isMac) img.setTemplateImage(true)
  return img
}
