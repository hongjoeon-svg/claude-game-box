/** 효과음·진동 (4단계에서 WebAudio 로 채움) */
export type Sfx = 'cross' | 'place' | 'clear' | 'error' | 'undo' | 'hint' | 'win' | 'tap';
export function sfx(_name: Sfx): void {}
export function vibrate(_pattern: number | number[]): void {}
export function unlockAudio(): void {}
