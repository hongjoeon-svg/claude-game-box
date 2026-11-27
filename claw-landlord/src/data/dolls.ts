// =====================================================================
//  인형 목록 — 전부 오리지널 동물·사물 캐릭터입니다.
//  (실존 캐릭터·브랜드를 닮지 않도록 단순한 도형 조합으로만 그립니다)
// =====================================================================

/** 인형 등급 — 2단계에서 희귀/전설 확률 업그레이드가 붙습니다 */
export type Grade = 'common' | 'rare' | 'legend';

/** 귀/머리 모양 — 플레이스홀더 그림에서 사용 */
export type EarStyle = 'round' | 'long' | 'pointy' | 'none' | 'leaf' | 'antenna';

export interface DollDef {
  id: string; // 스프라이트 키 (assets.ts 의 SPRITES 와 연결)
  name: string; // 화면에 뜨는 이름
  shape: 'circle' | 'box'; // 물리 모양
  size: number; // 원이면 반지름, 상자면 가로 절반
  aspect?: number; // 상자일 때 세로/가로 비율
  color: string; // 몸통 색
  accent: string; // 귀·볼 등 포인트 색
  ears: EarStyle;
  value: number; // 기본 코인 가치
  grade: Grade;
  weight: number; // 등장 가중치
  quips: string[]; // 뽑혔을 때 한마디
}

export const DOLLS: DollDef[] = [
  {
    id: 'malang_bear', name: '말랑곰', shape: 'circle', size: 25, color: '#c98b5a', accent: '#f2c9a0',
    ears: 'round', value: 10, grade: 'common', weight: 10, quips: ['말랑말랑~', '안아줘!'],
  },
  {
    id: 'sleepy_bunny', name: '졸린토끼', shape: 'circle', size: 23, color: '#f4eee8', accent: '#ffb4c8',
    ears: 'long', value: 10, grade: 'common', weight: 10, quips: ['5분만 더…', 'zzZ'],
  },
  {
    id: 'loaf_cat', name: '식빵냥', shape: 'box', size: 27, aspect: 0.72, color: '#f2a65a', accent: '#fff1dc',
    ears: 'pointy', value: 12, grade: 'common', weight: 8, quips: ['식빵 굽는 중', '냥.'],
  },
  {
    id: 'potato_hamster', name: '감자햄찌', shape: 'circle', size: 21, color: '#e8c48a', accent: '#fff6e6',
    ears: 'round', value: 8, grade: 'common', weight: 12, quips: ['볼 빵빵!', '해바라기씨 줘'],
  },
  {
    id: 'gaegul', name: '개굴이', shape: 'circle', size: 24, color: '#7cc96b', accent: '#d9f5c8',
    ears: 'none', value: 10, grade: 'common', weight: 9, quips: ['개굴!', '비 오는 날 좋아'],
  },
  {
    id: 'tofu', name: '두부씨', shape: 'box', size: 23, aspect: 0.85, color: '#fbfaf3', accent: '#e9e3c9',
    ears: 'none', value: 9, grade: 'common', weight: 9, quips: ['부드럽게 다뤄줘', '찌개 노노'],
  },
  {
    id: 'dumpling', name: '만두찐', shape: 'circle', size: 22, color: '#fff3df', accent: '#f0d4a8',
    ears: 'leaf', value: 9, grade: 'common', weight: 9, quips: ['갓 쪘어요', '김 모락모락'],
  },
  {
    id: 'waddle_peng', name: '뒤뚱펭', shape: 'box', size: 21, aspect: 1.25, color: '#3c4a66', accent: '#ffffff',
    ears: 'none', value: 11, grade: 'common', weight: 8, quips: ['뒤뚱뒤뚱', '미끄러진다~'],
  },
  {
    id: 'snail_post', name: '달팽배달', shape: 'circle', size: 22, color: '#b9a6e8', accent: '#f6d06b',
    ears: 'antenna', value: 11, grade: 'common', weight: 7, quips: ['배송 지연 죄송', '천천히 갈게요'],
  },
];

/** 가중치에 따라 랜덤으로 인형 종류 하나를 고릅니다 */
export function pickDollDef(rand: () => number = Math.random): DollDef {
  const total = DOLLS.reduce((s, d) => s + d.weight, 0);
  let r = rand() * total;
  for (const d of DOLLS) {
    r -= d.weight;
    if (r <= 0) return d;
  }
  return DOLLS[DOLLS.length - 1];
}
