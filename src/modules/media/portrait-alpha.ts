/** Inspect pixels, not just the presence of an alpha channel in a PNG/WebP. */
export function hasTransparency(rgba: Uint8ClampedArray | Uint8Array) {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 255) return true;
  }
  return false;
}

export function usableMatte(rgba: Uint8ClampedArray | Uint8Array) {
  let foreground = 0,
    background = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] > 200) foreground++;
    if (rgba[i] < 50) background++;
  }
  const pixels = rgba.length / 4;
  return foreground > pixels * 0.01 && background > pixels * 0.01;
}
