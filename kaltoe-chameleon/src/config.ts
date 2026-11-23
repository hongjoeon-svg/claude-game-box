/** 화면·레이아웃·밸런스 수치를 한곳에 모아둔 파일 */

/** 논리 해상도 (9:16 세로). 모든 좌표는 이 기준입니다. */
export const GAME_WIDTH = 450;
export const GAME_HEIGHT = 800;
/** 레티나 화면에서 선명하게 보이도록 내부 캔버스를 몇 배로 그릴지 */
export const RENDER_SCALE = 2;

export const TILE = 30;
export const MAP_COLS = 15;
export const MAP_ROWS = 20;
export const HUD_HEIGHT = 64;
export const MAP_X = 0;
export const MAP_Y = HUD_HEIGHT;
export const PANEL_Y = MAP_Y + MAP_ROWS * TILE; // 664
export const PANEL_HEIGHT = GAME_HEIGHT - PANEL_Y; // 136

export const FONT =
  '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,-apple-system,sans-serif';
export const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Apple SD Gothic Neo",sans-serif';

export const COLORS = {
  bg: 0x1b1d24,
  hud: 0x23262f,
  panel: 0x23262f,
  accent: 0x4cd964,
  danger: 0xff4d4f,
  warn: 0xffc53d,
  text: '#ffffff',
  subText: '#a7adba',
  fovIdle: 0xfff3a0,
  fovAlert: 0xff4d4f,
};

export const TUNING = {
  /** 플레이어 최고 이동 속도 (px/초) */
  playerSpeed: 105,
  playerRadius: 10,
  /** 이 속도(px/초) 이상이면 '움직이는 중'으로 판정 */
  moveThreshold: 4,
  /** 기본 변신 쿨타임 (스테이지 JSON에서 덮어쓸 수 있음) */
  transformCooldownMs: 1500,
  /** 의심 게이지 증가량 (초당 %) */
  suspicion: {
    moving: 75, // 시야 안에서 움직임
    unformed: 40, // 시야 안에서 변신 안 한 채 정지
    bad: 30, // 안 어울리는 소품
    ok: 12, // 애매한 소품 (normal 난이도)
    decay: 10, // 안 보일 때 초당 감소량
    closeBonus: 0.7, // 가까울수록 최대 +70%
  },
  /** 순찰자 회전 속도 (라디안/초) */
  patrollerTurnSpeed: 3.5,
  /** 순찰자와 이 거리 이내로 붙으면 무조건 발견 */
  bumpDistance: 16,
};
