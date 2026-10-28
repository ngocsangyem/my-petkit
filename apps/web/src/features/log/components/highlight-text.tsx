/**
 * `text` with every occurrence of a single-term `query` wrapped in `<mark>`.
 * Fragments are React text nodes, so nothing from the log ever becomes markup.
 * With several terms there is no one span to mark, so nothing is highlighted.
 */
export function HighlightText({ text, query }: { text: string; query: string }) {
  const terms = query.split(/\s+/).filter(Boolean);
  const needle = terms.length === 1 ? terms[0]?.toLowerCase() : undefined;
  if (!needle) return <>{text}</>;
  const low = text.toLowerCase();
  const parts: { text: string; hit: boolean; at: number }[] = [];
  let i = 0;
  for (let j = low.indexOf(needle); j !== -1; j = low.indexOf(needle, i)) {
    if (j > i) parts.push({ text: text.slice(i, j), hit: false, at: i });
    parts.push({ text: text.slice(j, j + needle.length), hit: true, at: j });
    i = j + needle.length;
  }
  if (i < text.length) parts.push({ text: text.slice(i), hit: false, at: i });
  return (
    <>
      {parts.map(p =>
        p.hit ? <mark key={p.at}>{p.text}</mark> : <span key={p.at}>{p.text}</span>,
      )}
    </>
  );
}
