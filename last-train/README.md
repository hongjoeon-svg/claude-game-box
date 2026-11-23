# 막차 이상현상

모바일 세로 화면용 1인칭 이상현상 찾기 루프 게임. 가상의 노선 "심야순환선" 막차 객차 한 칸을 걸으며
평소와 다른 점이 있는지 판단한다. Vite + TypeScript + Three.js, 서버 없이 완전 오프라인.

## 실행

```bash
npm install
npm run dev          # PC 브라우저: http://localhost:5173
npm run dev:host     # 같은 와이파이의 폰에서 접속 (터미널에 나오는 Network 주소)
npm run build        # dist/ 생성 (Capacitor 의 webDir)
```

개발용 URL 옵션
- `?debug` : FPS·드로우콜 표시 + 이상현상 on/off 패널
- `?a=<이상현상 id>` : 모든 칸에 그 이상현상 강제 (예: `?a=red-light`), `?a=none` 은 항상 정상

## 규칙
- 뒤쪽 끝에서 출발. 평소와 같으면 앞 칸 문, 이상현상이 하나라도 있으면 돌아서 뒤 칸 문.
- 뒤 칸 문은 객차 중간까지 가 봐야 열린다. 맞히면 전광판 숫자 +1, 틀리면 0. 8 이면 종착역 엔딩.
- 칸마다 약 60% 확률로 이상현상 1개, 같은 이상현상은 연속으로 나오지 않음. 런의 첫 칸은 항상 정상.

## 구조
```
src/
  main.ts                 화면(시작·설정·도감·일시정지·엔딩) 연결
  core/game.ts            렌더 루프, 칸 생성, 문 판정, 카운터, 흔들림
  core/input.ts           왼쪽 조이스틱 / 오른쪽 드래그 시점 / WASD+마우스
  core/audio.ts           WebAudio 합성 사운드 (주행음·덜컹·험·안내 방송)
  core/save.ts            localStorage 저장
  core/store.ts           추가 노선 인앱 결제 자리 (TODO: Capacitor 결제 플러그인 연결)
  car/build.ts            객차 조립 (정적 도형은 정점색 병합 메시 1개)
  car/signs.ts            노선도·광고·문 번호 등 표지 아틀라스 (CanvasTexture 1장)
  anomalies/types.ts      Anomaly / AnomalyPack 인터페이스
  anomalies/registry.ts   팩 목록, 이상현상 추첨
  anomalies/base/*.ts     기본 노선 이상현상 26종 (쉬움·보통·은근함·점프스케어)
```

### 이상현상 추가
`Anomaly` 객체를 만들어 팩의 `anomalies` 배열에 넣으면 끝. 객차는 칸마다 새로 만들어지므로 되돌리는 코드는 필요 없다.
- `configure(cfg)` 객차 생성 전 설정 변경 (좌석 제거, 승객 추가, 표지 문구…)
- `setup(ctx)` 생성 직후 한 번 (조명 색, 소리 설정…)
- `update(ctx, dt)` 매 프레임

### 추가 노선(인앱)
`registry.ts` 의 `PACKS` 에 `productId` 가 있는 팩을 추가하면 도감에 잠금 상태로 표시된다.
`store.ts` 의 `purchasePack` / `restorePurchases` 안에 네이티브 결제를 붙이고 성공 시 `save.entitlements` 에 productId 를 기록하면 해당 팩의 이상현상이 추첨 풀에 들어간다.

## 성능 메모
- 그림자 없음, 조명 3개(반구광 + 플레이어 위 점광원 + 연출용 점광원)
- 객차 정적 도형 1메시, 표지 1메시, 형광등·손잡이·옆문은 InstancedMesh → 약 20 드로우콜
- 픽셀 비율 최대 2, 안티앨리어싱 끔, 전광판 텍스처 업로드는 초당 15회
