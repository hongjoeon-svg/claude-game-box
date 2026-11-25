# 🦎 칼퇴 카멜레온 (MVP)

> 사무실 소품으로 위장해서 부장님 순찰을 피해 칼퇴하는 1인용 숨바꼭질 퍼즐

- 세로 9:16, 한 손 조작, 한 판 1~2분
- Phaser 3 + TypeScript + Vite, 서버 없음 (저장은 localStorage)
- 나중에 Capacitor로 iOS 앱으로 패키징할 수 있는 구조

---

## 1. 실행 방법

Node.js 18 이상이 필요합니다.

```bash
cd kaltoe-chameleon
npm install
npm run dev
```

터미널에 나오는 주소(`http://localhost:5173`)를 브라우저로 엽니다.
같은 와이파이에 있는 아이폰에서는 터미널에 함께 나오는 `Network: http://192.168.x.x:5173` 주소로 바로 테스트할 수 있습니다.

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (저장하면 자동 새로고침) |
| `npm run build` | 스테이지 검사 → 타입 검사 → `dist/`에 배포용 빌드 |
| `npm run preview` | 빌드 결과물 미리보기 |
| `npm run validate` | 스테이지 JSON만 검사 |
| `npm run typecheck` | TypeScript 타입 검사만 |
| `npm run build:site` | 메인 게임 목록 페이지용 빌드 → `play/`. 게임 코드를 고친 뒤 실행하고 `play/`도 함께 커밋 |

### 조작

| 동작 | 모바일 | PC (테스트용) |
| --- | --- | --- |
| 이동 | 지도 아무 곳이나 누르고 드래그 (가상 조이스틱) | 방향키 / WASD |
| 변신 | 하단 소품 버튼 | 숫자키 1~5 |
| 일시정지 | 왼쪽 위 Ⅱ 버튼 | ESC |

### 규칙 요약

- 움직이면 변신이 풀립니다. 멈춘 상태에서 쿨타임이 끝났을 때만 변신할 수 있습니다.
- 순찰자의 노란 부채꼴 시야 안에서는
  - 움직이면 의심 게이지가 **빠르게** 오릅니다 (❗)
  - 변신하지 않았거나, 그 장소에 안 어울리는 소품이면 **천천히** 오릅니다 (❓)
  - 장소에 어울리는 소품으로 가만히 있으면 **안전**합니다
- 벽 뒤는 보이지 않습니다. 책상·테이블은 시야를 가리지 않습니다.
- 게이지가 100%가 되면 "잠깐 자네, 이리 와봐" → 실패. 엘리베이터 🛗에 도착하면 칼퇴 성공.
- 게임 내 시계가 오후 5:55 → 6:00이 되면 야근 엔딩.
- 별 3개: ① 클리어 ② 최대 의심 50% 이하 ③ 스테이지별 `fastClearSec` 안에 클리어

---

## 2. 폴더 구조

```
kaltoe-chameleon/
├─ index.html               # 뷰포트·safe-area 설정
├─ vite.config.ts           # base: './' (Capacitor용 상대 경로)
├─ capacitor.config.json    # iOS 패키징 설정 (appId 등)
├─ scripts/validate-stages.mjs  # 스테이지 JSON 검사기
├─ public/assets/           # 실제 이미지·사운드를 넣을 곳
└─ src/
   ├─ main.ts               # Phaser 게임 생성
   ├─ config.ts             # 해상도, 레이아웃, ★밸런스 수치(TUNING)
   ├─ assets.ts             # ★에셋 키 레지스트리 (이모지 → 이미지 교체)
   ├─ data/
   │  ├─ zones.ts           # 장소별 '어울리는 소품' 표, 난이도별 판정
   │  ├─ stages.ts          # 스테이지 타입 정의 + 자동 로더
   │  └─ stages/stage1~5.json
   ├─ game/
   │  ├─ OfficeMap.ts       # 지도 그리기, 충돌, 시야(벽 가림) 계산
   │  ├─ Player.ts          # 카멜레온 이동·변신
   │  ├─ Patroller.ts       # 부장님·과장님 순찰 AI, 부채꼴 시야, 기습 확인
   │  ├─ PropButtonBar.ts   # 하단 변신 버튼
   │  └─ VirtualJoystick.ts # 플로팅 가상 조이스틱
   ├─ services/
   │  ├─ StorageService.ts  # 저장소 추상화 (지금은 localStorage)
   │  ├─ SaveData.ts        # 진행도·별·최고 기록·소리 설정
   │  ├─ AdService.ts       # 보상형 광고 인터페이스 + MockAdService
   │  └─ SoundService.ts    # 효과음 (파일 없으면 합성음), 진동 자리
   ├─ ui/                   # 텍스트·버튼 헬퍼
   └─ scenes/               # Boot → Title → StageSelect → Game → Result
```

### 밸런스 조절은 여기서

- `src/config.ts`의 `TUNING`: 이동 속도, 변신 쿨타임, 의심 게이지 증가·감소량, 순찰자 회전 속도
- `src/data/zones.ts`의 `PROP_FIT`: 장소마다 소품이 good / ok / bad 중 무엇인지

| 장소 \ 소품 | 화분 | 복합기 | 정수기 | 서류박스 | 의자 |
| --- | --- | --- | --- | --- | --- |
| 복도 | good | good | good | ok | bad |
| 사무실 | good | ok | bad | good | good |
| 탕비실 | good | bad | good | ok | ok |
| 회의실 | good | bad | bad | ok | good |

스테이지의 `strictness`가 `ok`를 어떻게 다루는지 정합니다:
`easy` = ok도 안전, `normal` = ok는 천천히 의심, `strict` = ok도 bad로 취급.

---

## 3. 스테이지 추가 방법

1. `src/data/stages/`에 `stage6.json`처럼 새 JSON 파일을 만듭니다. (기존 파일을 복사해서 고치면 편합니다)
2. `id`를 겹치지 않는 숫자로 정합니다. 스테이지 선택 화면은 `id` 순서로 정렬되고, 앞 스테이지를 깨야 열립니다.
3. `npm run validate`로 검사합니다. 지도 크기, 시작점→출구 경로, 순찰 경로가 벽을 지나는지까지 확인해줍니다.
4. `npm run dev`로 확인합니다. **코드는 고칠 필요 없습니다** (폴더의 JSON을 자동으로 불러옵니다).

### JSON 필드

```jsonc
{
  "id": 6,                       // 고유 번호 (정렬 순서)
  "name": "야근 전야",             // 스테이지 이름
  "description": "설명 한 줄",     // 선택 화면에 표시
  "timeLimitSec": 100,           // 5:55→6:00 이 걸리는 실제 초
  "fastClearSec": 55,            // 별 3번째 조건 (초)
  "transformCooldownMs": 1500,   // (선택) 변신 쿨타임, 없으면 config 기본값
  "strictness": "normal",        // easy | normal | strict
  "showHints": false,            // (선택) 버튼에 어울림 표시 점 (튜토리얼용)
  "props": ["plant", "copier", "water", "box", "chair"],  // 3~5개
  "tips": ["시작 후 차례로 뜨는 안내"],                     // (선택)
  "map": [ "...15글자 x 20줄..." ],
  "patrollers": [
    {
      "type": "boss",            // boss(부장님) | manager(과장님)
      "name": "부장님",            // (선택) 머리 위 이름
      "speed": 45,               // px/초 (타일 1칸 = 30px)
      "fovDeg": 70,              // 시야각 (도)
      "viewDist": 150,           // 시야 거리 (px)
      "path": [[1, 6], [13, 6], [13, 12], [1, 12]],  // 타일 좌표 [x, y]
      "mode": "loop",            // loop(순환) | pingpong(왕복)
      "waitMs": 600,             // 웨이포인트에서 멈추는 시간
      "lookAround": true,        // 멈춰서 두리번거리기
      "startIndex": 0,           // (선택) 시작 웨이포인트
      "surpriseCheck": {         // (선택) 기습 확인: 가끔 뒤로 휙
        "minIntervalMs": 3500, "maxIntervalMs": 6500,
        "warnMs": 600,           // 돌아보기 전 ‼️ 경고 시간
        "holdMs": 1300           // 뒤돌아본 채 유지 시간
      }
    }
  ]
}
```

### 지도 범례 (15칸 x 20줄 고정)

| 문자 | 의미 | 장소 판정 | 통과 | 시야 가림 |
| --- | --- | --- | --- | --- |
| `#` | 벽 | - | ✗ | ✓ |
| `.` | 복도 바닥 | 복도 | ✓ | |
| `o` | 사무실 바닥 | 사무실 | ✓ | |
| `k` | 탕비실 바닥 | 탕비실 | ✓ | |
| `m` | 회의실 바닥 | 회의실 | ✓ | |
| `d` | 책상 | 사무실 | ✗ | |
| `t` | 회의 테이블 | 회의실 | ✗ | |
| `c` | 탕비실 카운터 | 탕비실 | ✗ | |
| `E` | 엘리베이터(출구) | 복도 | ✓ | |
| `P` | 시작 위치 (정확히 1개) | 복도 | ✓ | |

- 좌표는 왼쪽 위가 `[0, 0]`, 오른쪽 아래가 `[14, 19]`입니다.
- 순찰 경로는 웨이포인트 사이를 **직선으로** 걸어갑니다. 꺾이는 곳마다 웨이포인트를 찍어주세요.
- 같은 장소 문자가 4칸 이상 이어지면 방 이름(회의실 등)이 자동으로 표시됩니다.

---

## 4. 그래픽·사운드 교체

지금은 전부 이모지와 도형입니다. 모든 키는 `src/assets.ts` 한 파일에 있습니다.

```ts
// 이미지 교체: public/assets/boss.png 를 넣고 image 경로만 추가
boss: { emoji: '👨‍💼', image: 'assets/boss.png' },

// 효과음 교체: public/assets/sfx/caught.mp3 를 넣고 file 경로만 추가
caught: { file: 'assets/sfx/caught.mp3', synth: { ... } },
```

`BootScene`이 경로가 채워진 에셋만 불러오고, 그림을 그리는 쪽(`createVisual`)은 이미지가 있으면 이미지를, 없으면 이모지를 씁니다.
이미지는 정사각형 PNG(권장 128x128 이상, 투명 배경)를 쓰세요.

---

## 5. 수익화 자리 (보상형 광고)

- `src/services/AdService.ts`
  - `AdService` 인터페이스: `isRewardedReady(placement)`, `showRewarded(placement): Promise<boolean>`
  - `MockAdService`: 3초짜리 가짜 광고 화면 (건너뛰기를 누르면 보상 없음)
- 광고가 붙는 곳 (한 판에 각 1회)
  - `revive`: 의심 게이지가 꽉 차서 들켰을 때 → 부활 (게이지 0 + 2.5초 무적)
  - `resetSuspicion`: 하단 📺 버튼 → 의심 게이지 초기화
- 실제 SDK를 붙일 때는 `AdService`를 구현한 클래스를 새로 만들고, 파일 맨 아래
  `export const adService: AdService = new MockAdService();` 한 줄만 바꾸면 됩니다.

---

## 6. Capacitor로 iOS 빌드하기

> macOS + Xcode(최신 버전) + Apple Developer 계정이 필요합니다. CocoaPods 또는 Swift Package Manager는 Capacitor가 안내하는 대로 설치하세요.

**1) Capacitor 설치** (프로젝트 폴더에서 한 번만)

```bash
npm install @capacitor/core @capacitor/ios
```

```bash
npm install -D @capacitor/cli
```

**2) 앱 정보 확인** — `capacitor.config.json`의 `appId`(예: `com.내이름.kaltoe`)와 `appName`을 내 것으로 바꿉니다. `webDir`은 `dist`로 그대로 둡니다.

**3) 웹 빌드**

```bash
npm run build
```

**4) iOS 프로젝트 생성** (한 번만, `ios/` 폴더가 생깁니다)

```bash
npx cap add ios
```

**5) 웹 빌드를 iOS 프로젝트로 복사**

```bash
npx cap sync ios
```

**6) Xcode 열기**

```bash
npx cap open ios
```

**7) Xcode 설정**

- `App` 타깃 → *Signing & Capabilities* → Team 선택 (Bundle Identifier = appId)
- *General* → *Deployment Info*: iPhone만, **Portrait만** 체크, *Requires full screen* 체크
- 상태 표시줄을 숨기려면 `Info.plist`에 `UIStatusBarHidden = YES`, `UIViewControllerBasedStatusBarAppearance = NO`
- 앱 아이콘·스플래시: `@capacitor/assets` 패키지로 한 번에 생성할 수 있습니다

**8) 실행·배포**

- 아이폰을 연결하고 ▶ 실행으로 실기기 테스트
- *Product → Archive* → *Distribute App* → App Store Connect 업로드 → TestFlight → 심사 제출

**코드를 고친 뒤에는** 매번 아래 두 개만 다시 실행하면 됩니다.

```bash
npm run build
```

```bash
npx cap sync ios
```

### 출시 전에 바꾸면 좋은 것

- 저장: iOS는 저장 공간이 부족하면 웹뷰의 localStorage를 지울 수 있습니다. `@capacitor/preferences`를 설치하고 `StorageService.ts`만 교체하세요. (지금 구조는 동기식이라, 앱 시작 때 한 번 읽어서 메모리에 올려두는 방식이 가장 간단합니다)
- 진동: `SoundService.ts`의 `vibrate()`를 `@capacitor/haptics`로 교체
- 광고: AdMob 등 Capacitor 플러그인으로 `AdService` 구현체 작성. 맞춤형 광고를 쓰면 ATT 권한 문구(`NSUserTrackingUsageDescription`)와 개인정보 보호 매니페스트가 필요합니다.
- `assets.ts`의 이모지를 실제 그림으로 교체 (이모지는 기기·OS마다 모양이 다릅니다)
