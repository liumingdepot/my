/** 作品图片：本地选图后压缩并转成 base64，直接存库 */

const MAX_EDGE = 1600
const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.46]

/** base64 字符上限，与服务端 MAX_IMAGE_LENGTH 对齐 */
export const MAX_IMAGE_CHARS = 2_800_000

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    img.src = url
  })
}

/** 选图 → 等比缩放 → 逐级降质输出 base64，避免大图把库和前台页面撑爆 */
export async function fileToImageDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('当前浏览器不支持图片处理')
  }
  ctx.drawImage(img, 0, 0, width, height)

  for (const quality of QUALITY_STEPS) {
    const url = canvas.toDataURL('image/webp', quality)
    if (url.length <= MAX_IMAGE_CHARS) return url
  }
  throw new Error('图片过大，请换一张分辨率更低的')
}

/** 展示用体积估算（base64 约 1.37 倍原图） */
export function estimateImageSize(dataUrl: string) {
  const bytes = Math.round((dataUrl.length * 3) / 4)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}