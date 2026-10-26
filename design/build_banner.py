#!/usr/bin/env python3
import os

LIGHT = dict(bg1="#FAFAF7", bg2="#EEF2FF", ink="#08090A", muted="#525866",
             accent="#0B5FFF", highlight="#D9FF3D", line="#D5DAE3",
             card="#0B0C0E", card_ink="#F8FAFC", card_muted="#8B93A7",
             pill="#FFFFFF", pill_line="#D5DAE3", glow="#0B5FFF")
DARK = dict(bg1="#08090A", bg2="#0E1420", ink="#FAFAF7", muted="#9CA3AF",
            accent="#6EA8FF", highlight="#D9FF3D", line="#1F2937",
            card="#020305", card_ink="#F8FAFC", card_muted="#8B93A7",
            pill="#111318", pill_line="#242A36", glow="#1D4ED8")
SANS = "Helvetica Neue, Helvetica, Arial, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"


def bars(x, y, p, width=800, gap=30, bar_w=18, base=8, tall=18):
    """17 bars: one per VIN character, position nine highlighted."""
    out = []
    for i in range(17):
        bx = x + i * (bar_w + gap)
        h = tall if i == 8 else base
        fill = p["highlight"] if i == 8 else p["ink"]
        out.append(f'<rect x="{bx:.1f}" y="{y + (tall - h):.1f}" width="{bar_w}" height="{h}" rx="1" fill="{fill}" opacity="{1 if i==8 else 0.55}"/>')
    return "\n".join(out)


def banner(p, suffix):
    w, h = 880, 360
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-labelledby="t{suffix} d{suffix}">
<title id="t{suffix}">vinplain</title>
<desc id="d{suffix}">The public record, in plain code. A typed, keyless TypeScript client for VIN decode, NHTSA recalls, complaints, crash ratings, and EPA fuel economy.</desc>
<defs>
  <linearGradient id="bg{suffix}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{p['bg1']}"/><stop offset="1" stop-color="{p['bg2']}"/>
  </linearGradient>
  <radialGradient id="glow{suffix}" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="{p['glow']}" stop-opacity="0.20"/><stop offset="1" stop-color="{p['glow']}" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="{w}" height="{h}" rx="20" fill="url(#bg{suffix})"/>
<circle cx="120" cy="20" r="210" fill="url(#glow{suffix})"/>
<rect x="1" y="1" width="{w-2}" height="{h-2}" rx="19" fill="none" stroke="{p['line']}" stroke-opacity="0.8"/>
{bars(40, 44, p, width=800, gap=30, bar_w=18, base=10, tall=24)}
<text x="40" y="114" font-family="{MONO}" font-size="8.5" letter-spacing="2.4" fill="{p['muted']}">PUBLIC VEHICLE RECORDS / US</text>
<text x="840" y="114" text-anchor="end" font-family="{MONO}" font-size="8.5" letter-spacing="2.4" fill="{p['muted']}">V0.2 / MIT</text>
<text x="36" y="182" font-family="{SANS}" font-size="76" font-weight="700" letter-spacing="-4" fill="{p['ink']}">vinplain<span fill="{p['accent']}">.</span></text>
<text x="40" y="220" font-family="{SANS}" font-size="24" letter-spacing="-0.5" fill="{p['ink']}">The public record, in plain code.</text>
<text x="41" y="246" font-family="{SANS}" font-size="12" fill="{p['muted']}">VIN decode, recalls, complaints, crash ratings, and fuel economy.</text>
<text x="41" y="263" font-family="{SANS}" font-size="12" fill="{p['muted']}">No API key. No black box. No per-lookup fee.</text>
<g font-family="{MONO}" font-size="8.5" letter-spacing="1.3">
  <rect x="41" y="280" width="96" height="22" rx="11" fill="{p['pill']}" stroke="{p['pill_line']}"/><text x="89" y="294" text-anchor="middle" fill="{p['accent']}">NO API KEY</text>
  <rect x="145" y="280" width="142" height="22" rx="11" fill="{p['pill']}" stroke="{p['pill_line']}"/><text x="216" y="294" text-anchor="middle" fill="{p['accent']}">ZERO RUNTIME DEPS</text>
  <rect x="295" y="280" width="52" height="22" rx="11" fill="{p['pill']}" stroke="{p['pill_line']}"/><text x="321" y="294" text-anchor="middle" fill="{p['accent']}">MIT</text>
</g>
<rect x="516" y="40" width="324" height="286" rx="14" fill="{p['card']}"/>
<circle cx="538" cy="62" r="4" fill="#F87171"/><circle cx="552" cy="62" r="4" fill="#FBBF24"/><circle cx="566" cy="62" r="4" fill="#34D399"/>
<text x="538" y="92" font-family="{MONO}" font-size="8.5" letter-spacing="1.5" fill="{p['card_muted']}">TERMINAL</text>
<text x="538" y="124" font-family="{MONO}" font-size="10.5" fill="{p['highlight']}">$ npx vinplain 1HGCM82633A004352</text>
<line x1="538" y1="138" x2="818" y2="138" stroke="{p['card_muted']}" stroke-opacity="0.25"/>
<text x="538" y="164" font-family="{MONO}" font-size="11" fill="{p['card_ink']}">2003 Honda Accord EX-V6</text>
<text x="538" y="190" font-family="{MONO}" font-size="9.5" fill="{p['card_muted']}">VIN          1HGCM82633A004352</text>
<text x="538" y="208" font-family="{MONO}" font-size="9.5" fill="{p['card_muted']}">Recalls      24 campaigns</text>
<text x="538" y="226" font-family="{MONO}" font-size="9.5" fill="{p['card_muted']}">Complaints   2013</text>
<text x="538" y="244" font-family="{MONO}" font-size="9.5" fill="{p['card_muted']}">Fuel         22 mpg combined</text>
<text x="538" y="262" font-family="{MONO}" font-size="9.5" fill="{p['card_muted']}">Safety       unavailable</text>
<circle cx="542" cy="292" r="4" fill="{p['highlight']}"/>
<text x="554" y="295" font-family="{MONO}" font-size="8.5" fill="{p['highlight']}">STATUS OK</text>
<text x="818" y="295" text-anchor="end" font-family="{MONO}" font-size="8" fill="{p['card_muted']}">NO KEY</text>
<text x="40" y="338" font-family="{MONO}" font-size="8" letter-spacing="1.6" fill="{p['muted']}">17 CHARACTERS / 9TH IS THE CHECK DIGIT</text>
</svg>'''


def mark(p):
    w, h = 64, 64
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="vinplain">',
           '<rect width="64" height="64" rx="16" fill="#0B0C0E"/>']
    for i in range(17):
        bx = 8 + i * 2.9
        height = 28 if i == 8 else 16
        fill = p["highlight"] if i == 8 else "#F8FAFC"
        out.append(f'<rect x="{bx:.1f}" y="{48-height}" width="1.7" height="{height}" rx="0.6" fill="{fill}" opacity="{1 if i==8 else 0.9}"/>')
    out.append('</svg>')
    return "\n".join(out)


out = os.path.join(os.path.dirname(__file__), "..", "assets")
open(os.path.join(out, "banner-light.svg"), "w").write(banner(LIGHT, "L"))
open(os.path.join(out, "banner-dark.svg"), "w").write(banner(DARK, "D"))
open(os.path.join(out, "logo.svg"), "w").write(mark(LIGHT))
print("wrote vinplain banner + logo")
