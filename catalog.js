export const prices = [['suggested','Sugerido'],['t2','Tabela 2'],['t4','Tabela 4'],['t5','Tabela 5']];
export const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export const terms = query => normalize(query).trim().split(/\s+/).filter(Boolean).map(word => word.replace(/(\d),(\d)/g,'$1.$2'));
const indexed = value => normalize(value).replace(/(\d),(\d)/g,'$1.$2');
export function codeMatchRank(code, query) {
  if (code === query) return 0;
  if (!/^\d+$/.test(query)) return;
  const digits = code.replace(/\D/g,'');
  if (digits.replace(/^0+/,'') === query.replace(/^0+/,'') && digits) return 1;
  if (digits.includes(query)) return 2;
}
export function search(rows, query) {
  const words = terms(query);
  const key = normalize(query).trim();
  if (!words.length) return rows;
  return rows.map(row => {
    const code = normalize(row.code);
    const match = codeMatchRank(code,key);
    if (match !== undefined) return {row, rank:match};
    const name = indexed(row.name);
    return {row, rank: words.every(word => name.includes(word) || code.includes(word)) ? 3 : 4};
  }).filter(match => match.rank < 4).sort((a,b) => a.rank - b.rank).map(match => match.row);
}
export function highlights(value, query) {
  const letters = Array.from(value);
  const index = [];
  const plain = letters.map((letter, pos) => {
    const normalized = normalize(letter);
    for (let i = 0; i < normalized.length; i++) index.push(pos);
    return normalized;
  }).join('').replace(/(\d),(\d)/g,'$1.$2');
  const marked = new Set();
  for (const word of terms(query)) {
    for (let at = plain.indexOf(word); at !== -1; at = plain.indexOf(word, at + word.length)) {
      for (let i = at; i < at + word.length; i++) marked.add(index[i]);
    }
  }
  const runs = [];
  letters.forEach((letter, pos) => {
    const hit = marked.has(pos);
    if (runs.at(-1)?.hit === hit) runs.at(-1).text += letter;
    else runs.push({text:letter,hit});
  });
  return runs;
}
