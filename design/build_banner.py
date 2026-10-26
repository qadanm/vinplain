#!/usr/bin/env python3
import os

LIGHT = dict(bg="#F4F4F1", ink="#111214", muted="#5F646A", line="#C9CDD2",
             cell="#FFFFFF", red="#D7261E", red_ink="#FFFFFF")
DARK = dict(bg="#0B0C0D", ink="#F2F2EF", muted="#9CA1A7", line="#2A2D31",
            cell="#141618", red="#FF4D3D", red_ink="#0B0C0D")
SANS = "Helvetica Neue, Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
VIN = "1HGCM82633A004352"


def banner(p, suffix):
    w, h = 880, 380
    cell_w, cell_h, gap = 42, 42, 4
    x0, y0 = 40, 196
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-labelledby="t{suffix} d{suffix}">',
           f'<title id="t{suffix}">vinplain</title>',
           f'<desc id="d{suffix}">A public vehicle record: the 17-character VIN 1HGCM82633A004352 with the check digit at position nine marked in red, followed by the decoded 2003 Honda Accord record, 24 recall campaigns, 2013 complaints, and 22 mpg combined.</desc>',
           f'<rect width="{w}" height="{h}" fill="{p["bg"]}"/>',
           f'<rect x="20" y="20" width="{w-40}" height="{h-40}" fill="none" stroke="{p["line"]}" stroke-width="1"/>',
           f'<text x="40" y="42" font-family="{MONO}" font-size="8" letter-spacing="2.2" fill="{p["muted"]}">VINPLAIN / PUBLIC RECORD</text>',
           f'<text x="840" y="42" text-anchor="end" font-family="{MONO}" font-size="8" letter-spacing="2.2" fill="{p["muted"]}">V0.2 / MIT</text>',
           f'<text x="36" y="126" font-family="{SANS}" font-size="72" font-weight="700" letter-spacing="-4.5" fill="{p["ink"]}">vinplain</text>',
           f'<text x="40" y="158" font-family="{SANS}" font-size="20" letter-spacing="-0.3" fill="{p["ink"]}">Public vehicle records for TypeScript.</text>',
           f'<text x="40" y="180" font-family="{SANS}" font-size="11.5" fill="{p["muted"]}">VIN decode, recalls, complaints, crash ratings, and fuel economy.</text>']
    for i, ch in enumerate(VIN):
        x = x0 + i * (cell_w + gap)
        highlighted = i == 8
        fill = p["red"] if highlighted else p["cell"]
        stroke = p["red"] if highlighted else p["line"]
        out.append(f'<rect x="{x}" y="{y0}" width="{cell_w}" height="{cell_h}" fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
        out.append(f'<text x="{x + cell_w/2:.1f}" y="{y0 + 27}" text-anchor="middle" font-family="{MONO}" font-size="17" fill="{p["red_ink"] if highlighted else p["ink"]}">{ch}</text>')
    mid = x0 + 8 * (cell_w + gap) + cell_w / 2
    out += [
        f'<line x1="{mid}" y1="{y0+cell_h}" x2="{mid}" y2="{y0+cell_h+8}" stroke="{p["red"]}" stroke-width="1"/>',
        f'<text x="{mid}" y="{y0+cell_h+20}" text-anchor="middle" font-family="{MONO}" font-size="7" letter-spacing="1.4" fill="{p["red"]}">CHECK DIGIT</text>',
    ]
    cols = [("MAKE", "HONDA"), ("MODEL", "ACCORD"), ("YEAR", "2003"),
            ("RECALLS", "24"), ("COMPLAINTS", "2013"), ("FUEL", "22 MPG")]
    for i, (label, value) in enumerate(cols):
        x = 40 + i * 138
        if i:
            out.append(f'<line x1="{x-14}" y1="268" x2="{x-14}" y2="326" stroke="{p["line"]}" stroke-width="1"/>')
        out.append(f'<text x="{x}" y="282" font-family="{MONO}" font-size="7" letter-spacing="1.5" fill="{p["muted"]}">{label}</text>')
        out.append(f'<text x="{x}" y="300" font-family="{MONO}" font-size="11" fill="{p["ink"]}">{value}</text>')
    out += [
        f'<line x1="40" y1="324" x2="840" y2="324" stroke="{p["line"]}" stroke-width="1"/>',
        f'<text x="40" y="346" font-family="{MONO}" font-size="7.5" letter-spacing="1.3" fill="{p["muted"]}">SOURCES / vPIC · NHTSA · EPA</text>',
        f'<text x="840" y="346" text-anchor="end" font-family="{MONO}" font-size="7.5" letter-spacing="1.3" fill="{p["muted"]}">NO API KEY / PUBLIC DATA</text>',
        '</svg>'
    ]
    return "\n".join(out)


def mark(p):
    w = h = 64
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="vinplain">',
           f'<rect width="{w}" height="{h}" fill="{p["ink"]}"/>']
    for i in range(17):
        bx = 8 + i * 2.9
        height = 30 if i == 8 else 18
        fill = p["red"] if i == 8 else p["bg"]
        out.append(f'<rect x="{bx:.1f}" y="{50-height}" width="1.8" height="{height}" fill="{fill}"/>')
    out.append('</svg>')
    return "\n".join(out)


out = os.path.join(os.path.dirname(__file__), "..", "assets")
open(os.path.join(out, "banner-light.svg"), "w").write(banner(LIGHT, "L"))
open(os.path.join(out, "banner-dark.svg"), "w").write(banner(DARK, "D"))
open(os.path.join(out, "logo.svg"), "w").write(mark(LIGHT))
print("wrote public-record banner + logo")
