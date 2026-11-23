/** 받침에 따라 조사 고르기: josa('부장님', '을', '를') → '부장님을' */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return word + withFinal;
  return word + ((ch - 0xac00) % 28 ? withFinal : withoutFinal);
}
