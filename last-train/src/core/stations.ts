// 가상의 노선 "심야순환선". 실제 노선·역 이름과 무관.
export const LINE_NAME = '심야순환선';
export const STATIONS = ['자정', '은하동', '달무리', '등불시장', '잿빛나루', '안개골', '소금다리', '옛우물', '그믐', '새벽'];
export const GOAL = 8;
/** 진행도 count 일 때 다음 역 인덱스 */
export const nextStationIndex = (count: number) => Math.min(count + 1, STATIONS.length - 1);
export const TERMINAL = STATIONS[STATIONS.length - 1];
