# 숨바꼭칠

몸에 색을 칠해 배경에 숨는 1인용 위장 퍼즐 (iPhone 출시 목표).
Vite + TypeScript + Canvas 2D, 게임 엔진·외부 에셋 없이 전부 코드로 그립니다.

## 실행

```bash
cd sumbakkochil
npm install
npm run dev        # http://localhost:5173 (같은 와이파이의 폰에서도 Network 주소로 접속 가능)
npm test           # 위장 판정 단위 테스트 (Vitest)
npm run build      # 타입 검사 + dist/ 빌드
```

## 폴더 구조

| 폴더 | 내용 |
|---|---|
| `src/scenes` | 화면(씬): 타이틀, 게임(배치→칠하기→결과) |
| `src/game` | 순수 로직: 위장 판정, 색 변환(CIELAB), 실행취소, 시드 난수 |
| `src/render` | 화면 스케일링, 캐릭터 실루엣, 맵 그리기, 판정용 버퍼 추출 |
| `src/data` | 스테이지 데이터 (`stages.ts`) |
| `src/ui` | 캔버스 버튼, HUD |
| `src/storage` | 저장 (localStorage → 나중에 Capacitor Preferences로 교체) |
| `src/monetization` | 광고 자리 (빈 함수) |
| `tests` | Vitest 단위 테스트 |

## 위장 판정

`src/game/camouflage.ts` (순수 함수). 맵의 1/4 해상도에서 계산합니다.

- 색 차이 60%: 실루엣 안 픽셀별 CIE76 ΔE 평균 (ΔE 2.3 이하 만점, 50 이상 0점)
- 윤곽 대비 30%: 경계 안쪽 캐릭터 색 vs 바깥 배경 색 — 배경에 원래 있던 대비는 빼고 "새로 생긴" 대비만 감점
- 칠한 면적 10%: 칠한 픽셀 비율
- 칠 안 한 흰 픽셀은 색·윤곽 모두 최대 감점으로 취급 (파스텔 맵에서 흰 몸이 우연히 높은 점수를 받지 않게)

## 진행 상황

- [x] Phase 1 — 핵심 프로토타입 (편의점 1스테이지, 배치/브러시/스포이드/실행취소, 판정, 결과)
- [ ] Phase 2 — 술래 AI
- [ ] Phase 3 — 콘텐츠 (맵 3 × 스테이지 5, 해금/별/저장, 채우기/지우개/겹쳐보기, 포즈 3종)
- [ ] Phase 4 — 연출/폴리시
- [ ] Phase 5 — iOS 준비 (Capacitor)
