// 색 공간 변환 유틸 (순수 함수)
// sRGB(0~255) → CIELAB 변환과 CIE76 색차(ΔE)를 계산합니다.

/** sRGB 감마를 풀어 선형값으로 바꾸는 표 (0~255 → 0~1). 매번 pow를 계산하지 않도록 미리 만들어 둠 */
const SRGB_TO_LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// D65 기준 백색점
const XN = 0.95047;
const ZN = 1.08883;

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export type Lab = [number, number, number];

/** sRGB(정수 0~255) → CIELAB [L, a, b] */
export function rgbToLab(r: number, g: number, b: number, out: Lab = [0, 0, 0]): Lab {
  const R = SRGB_TO_LINEAR[r & 255];
  const G = SRGB_TO_LINEAR[g & 255];
  const B = SRGB_TO_LINEAR[b & 255];
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / XN;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / ZN;
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  out[0] = 116 * fy - 16;
  out[1] = 500 * (fx - fy);
  out[2] = 200 * (fy - fz);
  return out;
}

/** CIE76 색차: Lab 공간에서의 유클리드 거리. 2.3 정도면 사람 눈으로 겨우 구분되는 수준 */
export function deltaE76(l1: number, a1: number, b1: number, l2: number, a2: number, b2: number): number {
  const dl = l1 - l2;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/** RGBA 버퍼 전체를 Lab 버퍼(픽셀당 3개 float)로 변환 */
export function rgbaToLabBuffer(rgba: ArrayLike<number>, pixelCount: number): Float32Array {
  const out = new Float32Array(pixelCount * 3);
  const tmp: Lab = [0, 0, 0];
  for (let i = 0; i < pixelCount; i++) {
    rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], tmp);
    out[i * 3] = tmp[0];
    out[i * 3 + 1] = tmp[1];
    out[i * 3 + 2] = tmp[2];
  }
  return out;
}

/** "#rrggbb" ↔ [r,g,b] */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
