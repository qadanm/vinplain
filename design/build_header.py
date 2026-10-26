#!/usr/bin/env python3
import os

LIGHT = dict(bg="#F2EFE8", ink="#141414", muted="#6A665F", line="#141414", accent="#C2410C")
DARK = dict(bg="#17191A", ink="#EDEAE2", muted="#9A958C", line="#EDEAE2", accent="#FF6A1A")
SANS = "Helvetica Neue, Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

def header(p):
    w, h = 880, 170
    rows = [("vPIC", "VIN DECODE"), ("NHTSA", "RECALLS + RATINGS"), ("EPA", "FUEL ECONOMY")]
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-labelledby="t d">',
           '<title id="t">vehicle-research</title>',
           '<desc id="d">Public vehicle data, typed. A TypeScript client for vPIC VIN decoding, NHTSA recalls and ratings, and EPA fuel economy.</desc>',
           f'<rect width="{w}" height="{h}" fill="{p["bg"]}"/>',
           f'<rect x="16" y="16" width="{w-32}" height="{h-32}" fill="none" stroke="{p["line"]}" stroke-width="1"/>',
           f'<path d="M16 30V16h14 M850 16h14v14 M864 140v14h-14 M30 154H16v-14" fill="none" stroke="{p["line"]}" stroke-width="1.3"/>',
           f'<text x="34" y="42" font-family="{MONO}" font-size="8" letter-spacing="2" fill="{p["muted"]}">VEHICLE-RESEARCH / PRE-RELEASE 0.1.0</text>',
           f'<text x="846" y="42" text-anchor="end" font-family="{MONO}" font-size="8" letter-spacing="2" fill="{p["muted"]}">PUBLIC DATA / NO API KEYS</text>',
           f'<text x="32" y="92" font-family="{SANS}" font-size="40" font-weight="700" letter-spacing="-1.4" fill="{p["ink"]}">Public vehicle data, typed.</text>',
           f'<text x="34" y="118" font-family="{MONO}" font-size="10" letter-spacing="1.5" fill="{p["muted"]}">VIN VALIDATION / NHTSA / EPA</text>',
           f'<rect x="34" y="130" width="58" height="3" fill="{p["accent"]}"/>']
    for i, (name, what) in enumerate(rows):
        y = 66 + i * 27
        out.append(f'<line x1="596" y1="{y-10}" x2="846" y2="{y-10}" stroke="{p["line"]}" stroke-opacity="0.25"/>')
        out.append(f'<text x="600" y="{y}" font-family="{MONO}" font-size="8.5" letter-spacing="1.6" fill="{p["accent"]}">{name}</text>')
        out.append(f'<text x="846" y="{y}" text-anchor="end" font-family="{MONO}" font-size="8.5" letter-spacing="1.2" fill="{p["muted"]}">{what}</text>')
    out.append(f'<line x1="596" y1="{66+3*27-10}" x2="846" y2="{66+3*27-10}" stroke="{p["line"]}" stroke-opacity="0.25"/>')
    out.append('</svg>')
    return "\n".join(out)

for name, p in [("header-light", LIGHT), ("header-dark", DARK)]:
    open(os.path.join(os.path.dirname(__file__), "..", "assets", f"{name}.svg"), "w").write(header(p))
print("wrote headers")
