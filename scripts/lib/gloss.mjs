// One-line summary of a note, shared by the entry pages, the graph data and the
// agent kit — so a node reads the same wherever it is quoted.
export function gloss(body, { min = 40, max = 220 } = {}) {
  const head = String(body ?? '').split(/^## /m)[0].replace(/<!--[\s\S]*?-->/g, '').trim();
  const first = head.split(/\n\s*\n/)[0]
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!first) return '';
  const m = first.match(new RegExp(`^(.{${min},${max}}?[.!?])(\\s|$)`));
  if (m) return m[1];
  return first.length <= max ? first : first.slice(0, max).replace(/\s\S*$/, '') + '…';
}
