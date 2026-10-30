/**
 * Image Cropping & Compression Utility for Kraft Agency Dashboard
 * Performs in-browser center-cropping and high-efficiency WebP/JPEG compression
 * before transmitting to the /api/upload endpoint.
 */

export async function cropAndCompressImage(file, options = {}) {
  const {
    aspectRatio = 1, // width / height
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.82,
    format = 'image/webp'
  } = options

  if (!file || !(file instanceof Blob)) {
    throw new Error('Valid image file is required for compression')
  }

  // Load image safely via Object URL
  const imgUrl = URL.createObjectURL(file)
  const img = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = (err) => reject(new Error('Failed to decode image: ' + err))
    image.src = imgUrl
  })

  try {
    const srcW = img.naturalWidth || img.width
    const srcH = img.naturalHeight || img.height

    if (!srcW || !srcH) {
      throw new Error('Image dimensions could not be read')
    }

    // Calculate center-crop coordinates to match the required aspect ratio
    let cropX = 0
    let cropY = 0
    let cropW = srcW
    let cropH = srcH

    const srcAspect = srcW / srcH

    if (srcAspect > aspectRatio) {
      // Source is wider than target: trim horizontal sides
      cropW = Math.round(srcH * aspectRatio)
      cropX = Math.round((srcW - cropW) / 2)
    } else if (srcAspect < aspectRatio) {
      // Source is taller than target: trim vertical top/bottom
      cropH = Math.round(srcW / aspectRatio)
      cropY = Math.round((srcH - cropH) / 2)
    }

    // Determine target canvas dimensions respecting max bounds
    let targetW = cropW
    let targetH = cropH

    if (targetW > maxWidth) {
      targetW = maxWidth
      targetH = Math.round(maxWidth / aspectRatio)
    }
    if (targetH > maxHeight) {
      targetH = maxHeight
      targetW = Math.round(maxHeight * aspectRatio)
    }

    // Render to offscreen canvas
    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not acquire 2D canvas context')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH)

    // Export compressed blob
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b)
          else reject(new Error('Canvas export failed'))
        },
        format,
        quality
      )
    })

    // Construct File object for standard FormData submission
    const ext = format === 'image/webp' ? 'webp' : 'jpg'
    const originalName = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'compressed-image'
    const newFilename = `${originalName}-${targetW}x${targetH}.${ext}`

    return new File([blob], newFilename, {
      type: format,
      lastModified: Date.now()
    })
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
