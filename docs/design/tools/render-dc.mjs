// Minimal local renderer for .dc.html artboards: runs renderVals(), expands
// <sc-for>/<sc-if> and {{holes}}, maps /_blob/ urls to local images.
import fs from 'node:fs';
import path from 'node:path';

const [, , inDir, outDir, blobDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const blobs = {
  '38e9ae33b4e603f8aa6a989a45ef55a8': path.resolve(blobDir, 'miso.jpg'),
  '04acdb0fd9daefc6a525576e97df95d6': path.resolve(blobDir, 'mochi.jpg'),
};

class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState() {} forceUpdate() {}
}

const get = (scope, p) => {
  p = p.trim();
  if (p === 'true') return true;
  if (p === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
  if (/^'.*'$/.test(p)) return p.slice(1, -1);
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
};
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Find the matching close tag for a block element, honouring nesting.
function findClose(src, tag, from) {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(src))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return m.index;
  }
  throw new Error('unclosed ' + tag);
}

function expand(src, scope) {
  let out = '';
  let i = 0;
  const re = /<sc-(for|if)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(src))) {
    out += holes(src.slice(i, m.index), scope);
    const tag = 'sc-' + m[1];
    const bodyStart = m.index + m[0].length;
    const close = findClose(src, tag, bodyStart);
    const body = src.slice(bodyStart, close);
    const attr = (n) => (m[2].match(new RegExp(n + '="\\{\\{([^}]*)\\}\\}"')) || [])[1];
    if (m[1] === 'for') {
      const list = get(scope, attr('list')) || [];
      const as = (m[2].match(/as="([^"]+)"/) || [])[1];
      list.forEach((it, idx) => { out += expand(body, { ...scope, [as]: it, $index: idx }); });
    } else if (get(scope, attr('value'))) {
      out += expand(body, scope);
    }
    i = close + `</${tag}>`.length;
    re.lastIndex = i;
  }
  return out + holes(src.slice(i), scope);
}

function holes(s, scope) {
  return s
    .replace(/\s(on[A-Z]\w*)="\{\{[^}]*\}\}"/g, '')
    .replace(/(\s(?:checked|disabled|selected|open))="\{\{([^}]*)\}\}"/g, (_, a, p) => (get(scope, p) ? a : ''))
    .replace(/\{\{([^}]*)\}\}/g, (_, p) => esc(get(scope, p)));
}

for (const f of fs.readdirSync(inDir).filter((f) => f.endsWith('.dc.html'))) {
  const src = fs.readFileSync(path.join(inDir, f), 'utf8');
  const script = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  let vals = {};
  try {
    const Component = new Function('DCLogic', script + '\nreturn Component;')(DCLogic);
    vals = new Component({}).renderVals();
  } catch (e) { console.error(f, 'renderVals failed:', e.message); }
  const body = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
  const helmet = (body.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  let html;
  try { html = expand(body.replace(/<helmet>[\s\S]*?<\/helmet>/, ''), vals); }
  catch (e) { console.error(f, 'expand failed:', e.message); continue; }
  html = html.replace(/\/_blob\/([0-9a-f]{32})/g, (_, id) => 'file://' + blobs[id]);
  fs.writeFileSync(path.join(outDir, f.replace('.dc.html', '.html')),
    `<!doctype html><html><head><meta charset="utf-8">${helmet}</head><body>${html}</body></html>`);
}
console.log('rendered');
