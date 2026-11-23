/** 레벨마다 한 줄 상황 대사. 그 판에 나오는 캐릭터와 관련된 대사를 고른다. */
import type { Character } from './characters';
import { type Rng, randInt } from './core/rng';

export interface Line {
  speaker: Character;
  text: string;
}

/** 캐릭터 id → 그 캐릭터가 화제인 대사. {name} 은 캐릭터 이름 */
const ABOUT: Record<string, string[]> = {
  bujang: [
    '오늘 회식인데 부장님 옆엔 아무도 앉기 싫대요',
    '부장님이 "편하게 앉아~" 하셨지만 아무도 편하지 않아요',
    '부장님 아재개그 사정거리 밖으로 앉혀 주세요',
    '부장님 주간보고, 대각선 자리까지 다 들린대요',
  ],
  gwajang: [
    '과장님이 엑셀 매크로를 자랑하려고 기회를 노리고 있어요',
    '과장님 옆자리는 업무 폭탄이 떨어지는 자리래요',
    '과장님은 회의를 1시간 더 끌 수 있는 능력자예요',
  ],
  chajang: [
    '차장님 골프 이야기가 시작되면 회의가 끝나지 않아요',
    '"라떼는 말이야" 차장님이 오늘도 출근하셨어요',
    '차장님이 주말 등산 같이 가자고 할까 봐 다들 긴장 중',
  ],
  daeri: [
    '대리님은 3일째 야근 중이라 건드리면 위험해요',
    '대리님 커피 다섯 잔째… 조용히 앉혀 주세요',
    '대리님이 회의록 쓰는 척 이직 사이트를 보고 있어요',
  ],
  jooim: [
    '주임님이 모든 회의에 간식을 챙겨 왔어요',
    '주임님은 친절하지만 업무를 슬쩍 넘기는 달인이에요',
    '주임님 키보드 소리가 유난히 커요. 멀리 앉혀 주세요',
  ],
  mz: [
    'MZ 신입이 에어팟을 끼고 회의에 들어왔어요',
    'MZ 신입은 6시 정각 퇴근을 위해 회의를 빨리 끝내고 싶대요',
    'MZ 신입이 "이거 꼭 회의로 해야 해요?"라고 물었어요',
  ],
  intern: [
    '인턴은 첫 회의라 손에 땀이 흥건해요',
    '인턴이 회의 자료를 100부나 뽑아 왔어요',
    '인턴은 누구 옆에 앉든 긴장 상태예요',
  ],
  nephew: [
    '사장님 조카 옆자리는 말 한마디도 조심해야 해요',
    '사장님 조카가 낙하산이라는 소문… 아무도 입 밖에 안 내요',
    '사장님 조카가 선글라스를 벗지 않고 회의에 왔어요',
  ],
  couple: [
    '비밀연애 중인 두 사람, 붙어 앉으면 다 들킨대요',
    '비밀연애 커플이 눈빛을 주고받지 못하게 떨어뜨려 주세요',
    '사내연애 소문이 돌기 시작했어요. 자리 배치가 중요해요',
  ],
};

const GENERIC = [
  '월요일 아침 9시 회의. 다들 예민해요',
  '분기 실적 회의예요. 서로 탓하지 않게 떨어져 앉혀요',
  '에어컨 바람 자리 싸움이 치열해요',
  '오늘 회의는 "짧게" 한대요. 정말일까요?',
  '워크숍 버스 자리도 이렇게 정해야 할 것 같아요',
  '각 부서에서 딱 한 명씩만 회의에 보냈어요',
  '어제 회식 때 싸운 사람들이 있대요. 붙여 앉히면 안 돼요',
  '사장님이 갑자기 회의실에 들르신대요!',
  '팀 빌딩 데이인데 분위기가 싸늘해요',
  '연말 평가 시즌. 모두가 서로를 경계 중이에요',
];

export function pickLine(chars: Character[], rng: Rng): Line {
  // 대체로 캐릭터 대사, 가끔 일반 상황 (말하는 사람은 그 판의 캐릭터)
  const speaker = chars[randInt(rng, chars.length)];
  if (rng() < 0.25) return { speaker, text: GENERIC[randInt(rng, GENERIC.length)] };
  const subject = chars[randInt(rng, chars.length)];
  const pool = ABOUT[subject.id] ?? GENERIC;
  const text = pool[randInt(rng, pool.length)];
  // 화제의 주인공이 직접 말하면 어색하니 다른 사람이 말하게
  const others = chars.filter((c) => c.id !== subject.id);
  return { speaker: others.length ? others[randInt(rng, others.length)] : speaker, text };
}
