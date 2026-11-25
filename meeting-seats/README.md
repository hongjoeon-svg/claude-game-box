# 회의실 자리 배치

사이 나쁜 동료들을 회의실에 앉히는 모바일 세로형 로직 퍼즐 (Queens / Star Battle 규칙).
Vite + 순수 TypeScript + DOM/Canvas, 서버 없이 완전 오프라인, 저장은 localStorage.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (같은 Wi-Fi 의 폰에서도 접속 가능)
npm test         # vitest (퍼즐 1000개 유일해 검증 포함)
npm run build    # dist/ 로 빌드 (상대 경로라 Capacitor 에 바로 넣을 수 있음)
npm run build:page  # 게임 모음용: 저장소 루트의 meeting-seats.html 한 장으로 빌드
```

게임 모음 페이지(`index.html`)는 루트의 `meeting-seats.html` 을 연다. **게임 코드를 고친 뒤에는 `npm run build:page` 를 다시 돌려서 이 파일도 함께 커밋해야** GitHub Pages 에 반영된다.

개발 중 `?level=37` 을 붙이면 잠긴 레벨도 바로 열린다. `?daily` 는 오늘의 퍼즐.

## 구조

| 경로 | 내용 |
| --- | --- |
| `src/core/` | **UI 와 무관한 퍼즐 엔진** (DOM 사용 안 함) |
| `src/core/solver.ts` | 완전 탐색 솔버 (해답 개수) |
| `src/core/logic.ts` | 사람식 논리 솔버, 난이도 단계 판정 |
| `src/core/generator.ts` | 해답 → 구역 성장 → 유일해가 될 때까지 경계 수정 → 난이도 필터 |
| `src/core/levels.ts` | 레벨 1~200 / 오늘의 퍼즐 (시드 고정) |
| `src/core/hint.ts` | 힌트, 충돌 검사 |
| `src/game.ts` | 한 판의 상태, 실행 취소, 자동 X |
| `src/ui/boardView.ts` | 격자 렌더링, 탭/드래그 입력 |
| `src/screens/` | 홈·레벨 선택·설정·게임·클리어 화면 |
| `src/characters.ts` | 부서 캐릭터 9명 (Canvas 로 그린 얼굴) |
| `src/lines.ts` | 레벨별 상황 대사 |
| `src/audio.ts` | WebAudio 효과음, 진동 |
| `src/ads.ts` | 광고 호출 지점 (SDK 미연결) |
| `src/storage.ts` | localStorage 저장 |

## 난이도

논리 솔버가 쓴 가장 어려운 추론으로 정한다.

- **쉬움**: 단순 소거(같은 줄·부서·주변 X), 남은 칸 하나, 부서가 한 줄에 몰린 경우
- **보통**: "여기 앉히면 어떤 줄이 막힌다", k개 부서가 k개 줄을 독점하는 경우
- **어려움**: 한 칸에 앉혀 보고 끝까지 추론했을 때 모순이 나는지 봐야 하는 경우

논리만으로 풀리지 않는 퍼즐은 만들지 않는다.

## 광고 / 결제 연결

- `src/ads.ts` 의 `showRewardedAd()` (힌트 버튼), `showInterstitial()` (레벨 사이, 3클리어마다) 안에 SDK 호출을 넣으면 된다.
- 광고 제거 구매 여부는 localStorage `meetingSeats.adFree` = `"true"`. 설정 화면의 "구매" 버튼은 지금은 테스트용으로 결제 없이 켠다 → 실제 인앱 결제로 교체.

## Capacitor (iOS) 메모

```bash
npm i @capacitor/core @capacitor/ios && npm i -D @capacitor/cli
npx cap init "회의실 자리 배치" com.example.meetingseats --web-dir dist
npm run build && npx cap add ios && npx cap open ios
```

- `index.html` 은 `viewport-fit=cover` 이고 CSS 는 `env(safe-area-inset-*)` 로 노치/홈바를 피한다.
- iOS WebView 에는 `navigator.vibrate` 가 없어서 진동이 꺼진 상태로 동작한다. `@capacitor/haptics` 를 붙이면 `src/audio.ts` 의 `vibrate()` 만 바꾸면 된다.
