"""Wrap v3 iOS artboard bodies into standalone .dc.html files.

Bodies use [[TOKEN]] placeholders for the shared mark, tab bar and device
glyphs so every screen draws them identically.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
OUT = pathlib.Path(sys.argv[1])
CSS = (HERE / "head.css").read_text()
MISO = "/_blob/38e9ae33b4e603f8aa6a989a45ef55a8"
MOCHI = "/_blob/04acdb0fd9daefc6a525576e97df95d6"

MARK = ('<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">'
        '<circle cx="10" cy="10" r="8.5" fill="none" stroke="#0f6e66" stroke-width="2"/>'
        '<path d="M3.2 13.2 A8 8 0 0 0 16.8 13.2 Z" fill="#0f6e66"/></svg>')

TAB_ICONS = {
    "Home": '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    "Timeline": '<path d="M12 3v18M7 7h10M7 12h7M7 17h9"/>',
    "Pets": '<path d="M6 8 4 3l4 2.5M18 8l2-5-4 2.5"/><path d="M5 10c0-3 3-5 7-5s7 2 7 5v3c0 4-3 7-7 7s-7-3-7-7z"/><path d="M10 13h.01M14 13h.01"/>',
    "Server": '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>',
}


def tabbar(active: str) -> str:
    items = []
    for name, path in TAB_ICONS.items():
        cls = "tab on" if name == active else "tab"
        sw = "2" if name == active else "1.6"
        items.append(
            f'<span class="{cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            f'{path}</svg>{name}</span>')
    return '<nav class="tabbar" aria-label="Tabs">' + "".join(items) + "</nav>"


def drum(size: int, level: int) -> str:
    """The Purobot drum: a sphere on a base, litter filling its lower part,
    with the front opening drawn as an oval."""
    y = 82 - 64 * level / 100 * 0.6
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">'
            '<rect x="16" y="80" width="68" height="12" rx="6" fill="#e3e8e7" stroke="#131416" stroke-width="3"/>'
            '<clipPath id="dc"><circle cx="50" cy="46" r="34"/></clipPath>'
            '<circle cx="50" cy="46" r="34" fill="#ffffff"/>'
            f'<rect x="10" y="{y:.1f}" width="80" height="60" fill="#cfe5e2" clip-path="url(#dc)"/>'
            '<circle cx="50" cy="46" r="34" fill="none" stroke="#131416" stroke-width="3"/>'
            '<ellipse cx="50" cy="50" rx="19" ry="15" fill="#ffffff" fill-opacity=".55" stroke="#131416" stroke-width="3"/>'
            '</svg>')


def feeder(size: int, l1: int, l2: int) -> str:
    """Dual-hopper feeder: two windows whose fill is each hopper's level."""
    def window(x, lvl):
        h = 34 * lvl / 100
        return (f'<rect x="{x}" y="22" width="20" height="34" rx="5" fill="#ffffff"/>'
                f'<rect x="{x}" y="{56 - h:.1f}" width="20" height="{h:.1f}" rx="4" fill="#e9d9b8"/>'
                f'<rect x="{x}" y="22" width="20" height="34" rx="5" fill="none" stroke="#131416" stroke-width="2.5"/>')
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">'
            '<rect x="22" y="10" width="56" height="62" rx="12" fill="#ffffff" stroke="#131416" stroke-width="3"/>'
            + window(27, l1) + window(53, l2) +
            '<path d="M18 80h64l-6 10H24z" fill="#e3e8e7" stroke="#131416" stroke-width="3" stroke-linejoin="round"/>'
            '</svg>')


def fountain(size: int, level: int) -> str:
    y = 82 - 50 * level / 100
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">'
            '<clipPath id="fc"><rect x="20" y="30" width="60" height="54" rx="14"/></clipPath>'
            '<rect x="20" y="30" width="60" height="54" rx="14" fill="#ffffff"/>'
            f'<rect x="20" y="{y:.1f}" width="60" height="60" fill="#cfe0f2" clip-path="url(#fc)"/>'
            '<rect x="20" y="30" width="60" height="54" rx="14" fill="none" stroke="#131416" stroke-width="3"/>'
            '<path d="M50 30V16M42 16h16" stroke="#131416" stroke-width="3" stroke-linecap="round"/>'
            '</svg>')


def spray(size: int) -> str:
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">'
            '<rect x="34" y="18" width="32" height="68" rx="16" fill="#ffffff" stroke="#131416" stroke-width="3"/>'
            '<circle cx="50" cy="38" r="6" fill="none" stroke="#131416" stroke-width="3"/></svg>')


def icon(path: str, size: int = 18, color: str = "currentColor") -> str:
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            f'{path}</svg>')


ICONS = {
    "chev": '<path d="m9 6 6 6-6 6"/>',
    "back": '<path d="m15 6-6 6 6 6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "play": '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    "video": '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    "broom": '<path d="M14 4 9 13M6 14h8l2 6H4z"/>',
    "bag": '<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    "level": '<path d="M4 16c3-3 5 3 8 0s5 3 8 0M4 10h16"/>',
    "leaf": '<path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14M5 19l7-7"/>',
    "dots": '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
    "mic": '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    "speaker": '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    "camera": '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    "full": '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    "light": '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    "food": '<path d="M4 13h16a8 8 0 0 1-16 0zM8 9c1-2 2-2 2-4M13 9c1-2 2-2 2-4"/>',
    "minus": '<path d="M5 12h14"/>',
    "warn": '<path d="M12 4 2 20h20zM12 10v4M12 17h.01"/>',
    "edit": '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    "door": '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M15 12h.01"/>',
    "shield": '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/>',
    "pause": '<path d="M9 5v14M15 5v14"/>',
    "cat": '<path d="M6 8 4 3l4 2.5M18 8l2-5-4 2.5"/><path d="M5 10c0-3 3-5 7-5s7 2 7 5v3c0 4-3 7-7 7s-7-3-7-7z"/>',
    "bt": '<path d="m7 7 10 10-5 4V3l5 4L7 17"/>',
    "check": '<path d="m5 12 5 5 9-10"/>',
    "search": '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
    "down": '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    "file": '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    "log": '<path d="M5 6h14M5 12h14M5 18h9"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    "phone": '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    "cloud": '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/>',
    "wifi": '<path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01"/>',
    "wrench": '<path d="M14 6a4 4 0 0 0 5 5l-9 9-4-4 9-9a4 4 0 0 0-1-1z"/>',
}


def render(body: str) -> str:
    def sub(m):
        key, _, arg = m.group(1).partition(":")
        args = re.split(r"[:,]", arg) if arg else []
        if key == "MARK":
            return MARK
        if key == "TABS":
            return tabbar(args[0])
        if key == "DRUM":
            return drum(int(args[0]), int(args[1]))
        if key == "FEEDER":
            return feeder(int(args[0]), int(args[1]), int(args[2]))
        if key == "FOUNTAIN":
            return fountain(int(args[0]), int(args[1]))
        if key == "SPRAY":
            return spray(int(args[0]))
        if key == "MISO":
            return MISO
        if key == "MOCHI":
            return MOCHI
        if key == "I":
            size = int(args[1]) if len(args) > 1 else 18
            color = args[2] if len(args) > 2 else "currentColor"
            return icon(ICONS[args[0]], size, color)
        raise KeyError(key)
    return re.sub(r"\[\[([A-Z]+(?::[^\]]*)?)\]\]", sub, body)


def page(title: str, body: str, height: int) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&amp;family=IBM+Plex+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
<style>
{CSS}</style>
</helmet>
{render(body)}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":390,"height":{height}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
"""


if __name__ == "__main__":
    for src in sorted((HERE / "bodies").glob("*.html")):
        first, _, body = src.read_text().partition("\n")
        title, height = first.strip("<!- >").split("|")
        (OUT / f"{src.stem}.dc.html").write_text(page(title.strip(), body, int(height)))
        print("wrote", src.stem)
