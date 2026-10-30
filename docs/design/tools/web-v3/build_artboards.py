"""Wrap web v3 artboard bodies into standalone .dc.html files.

The web dashboard follows the iOS v3 look (soft cards on a tinted ground,
device drawings, pill controls). It reuses the iOS v3 stylesheet and glyph
helpers, adds the web layout in web.css, and draws the sidebar once via
[[NAV:<active>]] so every screen has the same frame.

Body first line: <!-- Title | width | height -->
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "ios-v3"))
import build_artboards as ios  # noqa: E402

OUT = pathlib.Path(sys.argv[1])
CSS = (HERE.parent / "ios-v3" / "head.css").read_text() + (HERE / "web.css").read_text()

ios.ICONS.update({
    "home": '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    "timeline": '<path d="M12 3v18M7 7h10M7 12h7M7 17h9"/>',
    "server": '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>',
    "gear": '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    "moon": '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    "qr": '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
    "key": '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
    "trash": '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    "upload": '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    "refresh": '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v5h5M4 13a8 8 0 0 0 14.6 4.5M20 20v-5h-5"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "close": '<path d="M6 6l12 12M18 6 6 18"/>',
    "calendar": '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    "scale": '<path d="M5 20h14M7 20l1-11h8l1 11M12 9V5M9 5h6"/>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    "external": '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
    "drop": '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
})

NAV = [
    (None, [("Home", "home", "web-home"), ("Timeline", "timeline", "web-timeline"), ("Pets", "cat", "web-pets")]),
    ("Server", [("Logs", "log", "web-logs"), ("Add a device", "bt", "web-provision"), ("Settings", "gear", "web-server")]),
    ("Advanced · needs step-up", [("Capture", "file", "web-capture"), ("Patchers", "wrench", "web-patchers")]),
]


def nav(active: str) -> str:
    groups = []
    for head, items in NAV:
        links = []
        for label, ico, target in items:
            cls = ' class="on" aria-current="page"' if label == active else ""
            links.append(f'<a href="{target}.dc.html"{cls}>{ios.icon(ios.ICONS[ico], 18)}{label}</a>')
        hd = f'<span class="hd">{head}</span>' if head else ""
        groups.append(f'<div class="nav">{hd}{"".join(links)}</div>')
    side = (
        '<aside class="side" aria-label="Main menu">'
        f'<a class="brand" href="web-home.dc.html">{ios.MARK}my-petkit</a>'
        '<span class="srv">Home server · v2.1.0</span>'
        + "".join(groups) +
        '<div class="foot"><span class="small"><span class="dot" style="background:#1e7b4f"></span>Live</span>'
        '<span class="mono muted">192.168.1.20:8443</span><span class="xs muted">TLS pinned</span></div>'
        '</aside>')
    phone = (
        '<header class="phonebar">'
        f'<a class="brand" href="web-home.dc.html">{ios.MARK}my-petkit</a>'
        f'<button class="iconbtn" aria-label="Open the menu">{ios.icon(ios.ICONS["menu"], 20)}</button>'
        '</header>')
    return side + phone


def render(body: str) -> str:
    body = re.sub(r"\[\[NAV:([^\]]+)\]\]", lambda m: nav(m.group(1)), body)
    return ios.render(body)


def page(title: str, body: str, width: int, height: int) -> str:
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
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{width},"height":{height}}}}}'>
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
        title, width, height = [p.strip() for p in first.strip("<!- >").split("|")]
        # "@from <stem> [dark]": the same screen at another width or in dark mode.
        if body.strip().startswith("@from "):
            stem, *flags = body.strip()[6:].split()
            body = (HERE / "bodies" / f"{stem}.html").read_text().partition("\n")[2]
            if "dark" in flags:
                body = body.replace('<div class="app"', '<div class="app dark"', 1)
        (OUT / f"{src.stem}.dc.html").write_text(page(title, body, int(width), int(height)))
        print("wrote", src.stem, width, height)
