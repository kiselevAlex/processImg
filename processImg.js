const resizeMe = (img, options, orientation) => {
  const canvas = document.createElement('canvas')
  let width = img.width
  let height = img.height

  if (width > height) {
    if (width > options.max_width) {
      height = Math.round(height *= options.max_width / width)
      width = options.max_width
    }
  } else if (height > options.max_height) {
    width = Math.round(width *= options.max_height / height)
    height = options.max_height
  }

  const r = ([6, 8, 5, 7]).indexOf(orientation) !== -1
  canvas.width = r ? height : width
  canvas.height = r ? width : height
  const ctx = canvas.getContext('2d')
  ctx.translate(0, 0)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  if (r) {
    switch (orientation) {
      case 6: ctx.rotate((90 * Math.PI) / 180); break
      case 8: ctx.rotate((-90 * Math.PI) / 180); break
      case 5: ctx.scale(-1, 1); ctx.rotate((90 * Math.PI) / 180); break
      case 7: ctx.scale(-1, 1); ctx.rotate((-90 * Math.PI) / 180); break
      default: break
    }
    ctx.drawImage(img, -canvas.height / 2, -canvas.width / 2, canvas.height, canvas.width)
  } else {
    switch (orientation) {
      case 3: ctx.rotate(Math.PI); break
      case 2: ctx.scale(-1, 1); break
      case 4: ctx.scale(-1, 1); break
      default: break
    }
    ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
  }
  ctx.restore()
  const dataURL = canvas.toDataURL(options.type)
  const binStr = atob(dataURL.split(',')[1])
  const len = binStr.length
  const arr = new Uint8Array(len)

  for (let i = 0; i < len; i += 1) {
    arr[i] = binStr.charCodeAt(i)
  }
  return arr
}

const getOrientation = (byts) => {
  const view = new DataView(byts)
  if (view.getUint16(0, false) !== 0xFFD8) {
    return -2
  }
  const length = view.byteLength
  let offset = 2
  while (offset < length) {
    if (view.getUint16(offset + 2, false) <= 8) return -1
    const marker = view.getUint16(offset, false)
    offset += 2
    if (marker === 0xFFE1) {
      const prep = view.getUint32(offset += 2, false)
      if (prep !== 0x45786966) return -1

      const little = view.getUint16(offset += 6, false) === 0x4949
      offset += view.getUint32(offset + 4, little)
      const tags = view.getUint16(offset, little)
      offset += 2
      for (let i = 0; i < tags; i += 1) {
        if (view.getUint16(offset + (i * 12), little) === 0x0112) {
          return view.getUint16(offset + (i * 12) + 8, little)
        }
      }
    } else if ((marker & 0xFF00) !== 0xFF00) { // eslint-disable-line 
      break
    } else {
      offset += view.getUint16(offset, false)
    }
  }
  return -1
}

const processfile = (file, options) => new Promise((resolve, reject) => {
  try {
    if (!(/image/i).test(file.type)) resolve(file)

    const reader = new FileReader()
    reader.onload = (event) => {
      const orientation = getOrientation(event.target.result)
      const blob = new Blob([event.target.result])
      window.URL = window.URL || window.webkitURL
      const blobURL = window.URL.createObjectURL(blob)
      const image = new Image()
      image.src = blobURL
      image.onload = () => {
        const resized = resizeMe(image, { ...options, type: file.type }, orientation)
        resolve(new File([resized], file.name, { type: file.type }))
      }
    }
    reader.readAsArrayBuffer(file)
  } catch (e) {
    reject(e)
  }
})

export default async (files, options = {
  max_height: 4000,
  max_width: 4000
}) => {
  if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
    return files
  }
  const result = []

  for (let i = 0; i < files.length; i += 1) {
    result.push(await processfile(files[i], options)) // eslint-disable-line
  }
  return result
}
