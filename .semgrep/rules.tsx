// Fixtures for .semgrep/rules.yml (TS/TSX rules).
export function Unsafe({ html }: { html: string }) {
  // ruleid: no-dangerously-set-inner-html
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Safe({ text }: { text: string }) {
  // ok: no-dangerously-set-inner-html
  return <div>{text}</div>;
}
