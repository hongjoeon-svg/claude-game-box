// =====================================================================
//  에셋(이미지·소리) 경로를 한곳에서 관리합니다.
//  지금은 전부 비어 있어서 코드로 그린 플레이스홀더가 쓰입니다.
//  나중에 그림이 생기면 public/assets/ 에 파일을 넣고 경로만 적어 주세요.
//    예) malang_bear: 'assets/dolls/malang_bear.png'
//  이미지는 인형 크기(지름)의 정사각형에 꽉 차게 그려집니다.
// =====================================================================

/** 인형 스프라이트 — 키는 data/dolls.ts 의 id */
export const SPRITES: Record<string, string | null> = {
  malang_bear: null,
  sleepy_bunny: null,
  loaf_cat: null,
  potato_hamster: null,
  gaegul: null,
  tofu: null,
  dumpling: null,
  waddle_peng: null,
  snail_post: null,
  // 기계 부품 (지금은 코드로 그림)
  claw_head: null,
  coin: null,
};

/** 효과음 — 비어 있으면 Web Audio 로 합성한 소리를 씁니다 */
export const SOUNDS: Record<string, string | null> = {
  move: null,
  drop: null,
  grab: null,
  slip: null,
  win: null,
  coin: null,
  miss: null,
};

const imageCache = new Map<string, HTMLImageElement>();

/** 등록된 이미지를 미리 불러옵니다 (실패하면 조용히 플레이스홀더 사용) */
export function preloadSprites(): void {
  for (const [key, path] of Object.entries(SPRITES)) {
    if (!path) continue;
    const img = new Image();
    img.src = path;
    img.onload = () => imageCache.set(key, img);
  }
}

/** 불러온 이미지가 있으면 반환, 없으면 null (→ 코드로 그림) */
export function getSprite(key: string): HTMLImageElement | null {
  return imageCache.get(key) ?? null;
}
