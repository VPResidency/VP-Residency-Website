#!/usr/bin/env python3
"""Generates the original festival artwork in public/assets/festive/ and the kolam pattern.

Everything is hand-built vector art (no stock images), so it stays crisp at any size and can be
recoloured or redrawn here. Run:  python3 scripts/build-festive-art.py
"""
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'festive')
os.makedirs(OUT, exist_ok=True)


def write(name, body, w, h, extra_defs='', style=''):
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
        f'<defs>{extra_defs}</defs>'
        + (f'<style>{style}</style>' if style else '')
        + body
        + '</svg>\n'
    )
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(svg)


def f(n):
    return f'{n:.1f}'.rstrip('0').rstrip('.')


def quad(p0, p1, p2, t):
    return (
        (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
        (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
    )


# ---------------------------------------------------------------------------------------------
# Shared pieces
# ---------------------------------------------------------------------------------------------
MARIGOLD_DEFS = (
    '<radialGradient id="mgO" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#FFC233"/>'
    '<stop offset=".6" stop-color="#F59E0B"/><stop offset="1" stop-color="#D9690A"/></radialGradient>'
    '<radialGradient id="mgY" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#FFE680"/>'
    '<stop offset=".6" stop-color="#FCC419"/><stop offset="1" stop-color="#E8A10C"/></radialGradient>'
)


def marigold(x, y, r, yellow=False):
    g = 'url(#mgY)' if yellow else 'url(#mgO)'
    petals = ''.join(
        f'<circle cx="{f(x + math.cos(a) * r * .62)}" cy="{f(y + math.sin(a) * r * .62)}" r="{f(r * .46)}" fill="{g}"/>'
        for a in [i * math.pi / 5 for i in range(10)]
    )
    return petals + f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * .55)}" fill="{g}"/>' \
        f'<circle cx="{f(x - r * .15)}" cy="{f(y - r * .18)}" r="{f(r * .18)}" fill="#FFF3C4" opacity=".55"/>'


LEAF_DEFS = (
    '<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F8A3B"/>'
    '<stop offset="1" stop-color="#1B5E20"/></linearGradient>'
    '<linearGradient id="leaf2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4CAF50"/>'
    '<stop offset="1" stop-color="#2E7D32"/></linearGradient>'
)


def mango_leaf(x, y, length, angle, alt=False):
    w = length * 0.22
    path = (
        f'M0 0 C{f(w)} {f(length * .25)} {f(w * .9)} {f(length * .7)} 0 {f(length)} '
        f'C{f(-w * .9)} {f(length * .7)} {f(-w)} {f(length * .25)} 0 0Z'
    )
    fill = 'url(#leaf2)' if alt else 'url(#leaf)'
    return (
        f'<g transform="translate({f(x)} {f(y)}) rotate({f(angle)})">'
        f'<path d="{path}" fill="{fill}"/>'
        f'<path d="M0 2 L0 {f(length * .92)}" stroke="#A5D6A7" stroke-width="1" opacity=".7"/></g>'
    )


def rope(y, w, color='#B7791F'):
    return (
        f'<path d="M0 {y} H{w}" stroke="{color}" stroke-width="3"/>'
        f'<path d="M0 {y} H{w}" stroke="#F6D58B" stroke-width="1" stroke-dasharray="3 4" opacity=".8"/>'
    )


# ---------------------------------------------------------------------------------------------
# Garlands (tile horizontally under the header)
# ---------------------------------------------------------------------------------------------
def garland_mango():
    w, h = 168, 96
    body = rope(6, w)
    for i, x in enumerate([14, 56, 98, 140]):
        body += mango_leaf(x, 7, 62 + (i % 2) * 10, -6 if i % 2 else 6, alt=i % 2 == 1)
    for x in [35, 119]:
        body += f'<path d="M{x} 7 V58" stroke="#B7791F" stroke-width="1.2"/>'
        body += marigold(x, 18, 9) + marigold(x, 36, 7.5, True) + marigold(x, 52, 6.5)
    body += marigold(77, 14, 7, True) + marigold(161, 14, 7, True) + marigold(-7, 14, 7, True)
    write('garland-mango.svg', body, w, h, MARIGOLD_DEFS + LEAF_DEFS)


def garland_marigold():
    w, h = 220, 96
    p0, p1, p2 = (0, 8), (110, 92), (220, 8)
    body = f'<path d="M0 8 Q110 92 220 8" stroke="#B7791F" stroke-width="1.5" fill="none"/>'
    n = 15
    for i in range(n + 1):
        x, y = quad(p0, p1, p2, i / n)
        body += marigold(x, y, 8.5, yellow=(i % 2 == 0))
    for k, x in enumerate([0, 220]):
        body += f'<circle cx="{x}" cy="8" r="9" fill="#C0392B"/><circle cx="{x}" cy="8" r="4" fill="#F5B7B1"/>'
    # tassel in the middle
    body += '<path d="M110 50 V92" stroke="#B7791F" stroke-width="1.2"/>'
    body += marigold(110, 62, 7, True) + marigold(110, 76, 6) + marigold(110, 89, 5, True)
    write('garland-marigold.svg', body, w, h, MARIGOLD_DEFS)


def garland_lights():
    w, h = 132, 64
    p0, p1, p2 = (0, 4), (66, 40), (132, 4)
    defs = ''.join(
        f'<radialGradient id="b{i}" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#FFFFFF"/>'
        f'<stop offset=".35" stop-color="{c}"/><stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>'
        for i, c in enumerate(['#FFD166', '#FF8C42', '#FFE29A', '#F25F5C'])
    )
    style = (
        '@keyframes tw{0%,100%{opacity:1}50%{opacity:.35}}'
        '.g{animation:tw 2.4s ease-in-out infinite}.d1{animation-delay:-.6s}.d2{animation-delay:-1.2s}.d3{animation-delay:-1.8s}'
    )
    body = '<path d="M0 4 Q66 40 132 4" stroke="#3B2A1A" stroke-width="1.6" fill="none"/>'
    for i, t in enumerate([0.12, 0.37, 0.63, 0.88]):
        x, y = quad(p0, p1, p2, t)
        body += (
            f'<g class="g d{i}"><circle cx="{f(x)}" cy="{f(y + 12)}" r="13" fill="url(#b{i})"/></g>'
            f'<rect x="{f(x - 2.5)}" y="{f(y - 1)}" width="5" height="5" rx="1" fill="#5B4636"/>'
            f'<ellipse cx="{f(x)}" cy="{f(y + 10)}" rx="4" ry="6" fill="url(#b{i})"/>'
            f'<ellipse cx="{f(x)}" cy="{f(y + 10)}" rx="2.6" ry="4.4" fill="{["#FFD166", "#FF8C42", "#FFE29A", "#F25F5C"][i]}"/>'
        )
    write('garland-lights.svg', body, w, h, defs, style)


def garland_tricolor():
    w, h = 132, 52
    body = '<path d="M0 5 Q66 18 132 5" stroke="#7A5C3A" stroke-width="1.5" fill="none"/>'
    cols = ['#FF9933', '#FFFFFF', '#138808']
    for i in range(3):
        x0 = 6 + i * 42
        ya = quad((0, 5), (66, 18), (132, 5), (x0 + 2) / 132)[1]
        yb = quad((0, 5), (66, 18), (132, 5), (x0 + 32) / 132)[1]
        tip = (x0 + 17, max(ya, yb) + 34)
        body += (
            f'<path d="M{f(x0 + 2)} {f(ya)} L{f(x0 + 32)} {f(yb)} L{f(tip[0])} {f(tip[1])}Z" fill="{cols[i]}" '
            f'stroke="{"#E0DCD3" if i == 1 else "none"}" stroke-width="1"/>'
        )
    write('garland-tricolor.svg', body, w, h)


def garland_lanterns():
    w, h = 176, 124
    defs = (
        '<linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#9C6B12"/><stop offset=".5" stop-color="#F2CF6B"/>'
        '<stop offset="1" stop-color="#9C6B12"/></linearGradient>'
        '<radialGradient id="lglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE9A8"/>'
        '<stop offset="1" stop-color="#FFB703" stop-opacity="0"/></radialGradient>'
    )
    style = '@keyframes sw{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}.l{transform-box:fill-box;transform-origin:50% 0;animation:sw 4s ease-in-out infinite}.l2{animation-delay:-2s}'
    body = '<path d="M0 5 Q88 22 176 5" stroke="#7A5C3A" stroke-width="1.5" fill="none"/>'

    def lantern(x, top, cord, cls):
        y = top + cord
        return (
            f'<g class="l {cls}"><path d="M{x} {top} V{y}" stroke="#7A5C3A" stroke-width="1.2"/>'
            f'<circle cx="{x}" cy="{y + 30}" r="26" fill="url(#lglow)" opacity=".8"/>'
            f'<path d="M{x - 7} {y} h14 l4 8 h-22z" fill="url(#lg)"/>'
            f'<path d="M{x - 13} {y + 8} h26 c3 10 3 34 0 44 h-26 c-3-10-3-34 0-44z" fill="url(#lg)"/>'
            f'<path d="M{x - 8} {y + 13} h16 v34 h-16z" fill="#FFE6A1"/>'
            f'<path d="M{x} {y + 13} v34 M{x - 8} {y + 30} h16" stroke="#9C6B12" stroke-width="1.4"/>'
            f'<path d="M{x - 9} {y + 52} h18 l-4 7 h-10z" fill="url(#lg)"/>'
            f'<path d="M{x} {y + 59} v8" stroke="#C0392B" stroke-width="2"/></g>'
        )

    body += lantern(44, 9, 16, '') + lantern(132, 9, 34, 'l2')
    for (sx, sy) in [(88, 30), (8, 40), (168, 52)]:
        body += f'<path d="M{sx} {sy - 6} l1.8 4.2 4.4.4-3.3 2.9 1 4.4-3.9-2.3-3.9 2.3 1-4.4-3.3-2.9 4.4-.4z" fill="#F2CF6B"/>'
    write('garland-lanterns.svg', body, w, h, defs, style)


def heart_path(x, y, s):
    return (
        f'M{f(x)} {f(y + s * .3)} C{f(x)} {f(y)} {f(x - s * .5)} {f(y - s * .1)} {f(x - s * .5)} {f(y + s * .25)} '
        f'C{f(x - s * .5)} {f(y + s * .55)} {f(x)} {f(y + s * .75)} {f(x)} {f(y + s)} '
        f'C{f(x)} {f(y + s * .75)} {f(x + s * .5)} {f(y + s * .55)} {f(x + s * .5)} {f(y + s * .25)} '
        f'C{f(x + s * .5)} {f(y - s * .1)} {f(x)} {f(y)} {f(x)} {f(y + s * .3)}Z'
    )


def garland_hearts():
    w, h = 132, 76
    defs = '<linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F06292"/><stop offset="1" stop-color="#C2185B"/></linearGradient>'
    body = '<path d="M0 5 Q66 20 132 5" stroke="#B0476D" stroke-width="1.2" fill="none"/>'
    for i, (x, cord, s) in enumerate([(22, 18, 18), (66, 34, 22), (110, 20, 16)]):
        top = quad((0, 5), (66, 20), (132, 5), x / 132)[1]
        body += f'<path d="M{x} {f(top)} V{f(top + cord)}" stroke="#B0476D" stroke-width="1"/>'
        body += f'<path d="{heart_path(x, top + cord, s)}" fill="url(#hg)"/>'
    write('garland-hearts.svg', body, w, h, defs)


# ---------------------------------------------------------------------------------------------
# Artwork for the greeting popup and the hero badge (240 x 240)
# ---------------------------------------------------------------------------------------------
FLAME_DEFS = (
    '<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFD27A" stop-opacity=".9"/>'
    '<stop offset=".45" stop-color="#FFB347" stop-opacity=".35"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>'
    '<linearGradient id="flameO" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF6A00"/><stop offset="1" stop-color="#FFC300"/></linearGradient>'
    '<linearGradient id="flameI" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFE066"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>'
    '<linearGradient id="clay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9773B"/><stop offset="1" stop-color="#8E3B12"/></linearGradient>'
    '<linearGradient id="clayRim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A0491A"/><stop offset=".5" stop-color="#E89257"/><stop offset="1" stop-color="#A0491A"/></linearGradient>'
)
FLAME_STYLE = (
    '@keyframes fl{0%,100%{transform:scale(1,1) skewX(0)}25%{transform:scale(.94,1.06) skewX(2deg)}'
    '50%{transform:scale(1.04,.95) skewX(-2deg)}75%{transform:scale(.97,1.04) skewX(1deg)}}'
    '@keyframes gl{0%,100%{opacity:.85}50%{opacity:1}}'
    '.fl{transform-box:fill-box;transform-origin:50% 100%;animation:fl 1.6s ease-in-out infinite}'
    '.fl2{animation-duration:1.9s;animation-delay:-.7s}.fl3{animation-duration:1.4s;animation-delay:-.3s}'
    '.gl{animation:gl 2.2s ease-in-out infinite}'
)


def flame(x, y, s, cls='fl'):
    """Flame whose base sits at (x, y); s = height."""
    return (
        f'<circle class="gl" cx="{f(x)}" cy="{f(y - s * .45)}" r="{f(s * 1.15)}" fill="url(#halo)"/>'
        f'<g class="{cls}"><path d="M{f(x)} {f(y - s)} C{f(x + s * .42)} {f(y - s * .45)} {f(x + s * .32)} {f(y)} {f(x)} {f(y)} '
        f'C{f(x - s * .32)} {f(y)} {f(x - s * .42)} {f(y - s * .45)} {f(x)} {f(y - s)}Z" fill="url(#flameO)"/>'
        f'<path d="M{f(x)} {f(y - s * .62)} C{f(x + s * .2)} {f(y - s * .3)} {f(x + s * .16)} {f(y - s * .04)} {f(x)} {f(y - s * .04)} '
        f'C{f(x - s * .16)} {f(y - s * .04)} {f(x - s * .2)} {f(y - s * .3)} {f(x)} {f(y - s * .62)}Z" fill="url(#flameI)"/></g>'
    )


def diya(cx, cy, w, cls='fl'):
    """Clay lamp centred at cx with rim at cy."""
    h = w * .42
    return (
        flame(cx + w * .3, cy - 2, w * .42, cls)
        + f'<path d="M{f(cx - w / 2)} {f(cy)} Q{f(cx)} {f(cy + h * 1.6)} {f(cx + w / 2)} {f(cy)} '
        f'Q{f(cx + w * .62)} {f(cy - h * .25)} {f(cx + w * .42)} {f(cy - h * .12)} Z" fill="url(#clay)"/>'
        + f'<ellipse cx="{f(cx - w * .03)}" cy="{f(cy)}" rx="{f(w * .47)}" ry="{f(h * .2)}" fill="url(#clayRim)"/>'
        + f'<ellipse cx="{f(cx - w * .03)}" cy="{f(cy)}" rx="{f(w * .36)}" ry="{f(h * .12)}" fill="#5A2209"/>'
        + f'<path d="M{f(cx - w * .32)} {f(cy + h * .45)} Q{f(cx)} {f(cy + h * .95)} {f(cx + w * .32)} {f(cy + h * .45)}" '
        f'stroke="#F6C26B" stroke-width="{f(w * .025)}" fill="none" stroke-dasharray="{f(w * .03)} {f(w * .045)}"/>'
    )


def art_diya():
    body = '<ellipse cx="120" cy="212" rx="100" ry="12" fill="#000" opacity=".14"/>'
    body += diya(50, 178, 78, 'fl fl2') + diya(190, 180, 74, 'fl fl3') + diya(120, 170, 128)
    for (x, y, r) in [(34, 54, 3), (206, 46, 2.5), (176, 84, 2), (64, 92, 2), (120, 30, 2.5)]:
        body += f'<circle class="gl" cx="{x}" cy="{y}" r="{r}" fill="#FFD27A"/>'
    write('art-diya.svg', body, 240, 240, FLAME_DEFS, FLAME_STYLE)


def art_lamps():
    body = (
        '<path d="M8 206 H232 V224 H8Z" fill="#7A4A2A"/><path d="M8 206 H232" stroke="#C9894F" stroke-width="3"/>'
        '<path d="M28 156 H212 V168 H28Z" fill="#8C5634"/><path d="M28 156 H212" stroke="#C9894F" stroke-width="2"/>'
    )
    for i, x in enumerate([30, 75, 120, 165, 210]):
        body += diya(x, 202, 46, ['fl', 'fl fl2', 'fl fl3', 'fl fl2', 'fl'][i])
    for i, x in enumerate([52, 97, 143, 188]):
        body += diya(x, 152, 42, ['fl fl3', 'fl', 'fl fl2', 'fl fl3'][i])
    body += '<circle class="gl" cx="120" cy="52" r="26" fill="url(#halo)"/><circle cx="120" cy="52" r="7" fill="#FFE29A"/>'
    for (x, y) in [(40, 60), (200, 70), (70, 30), (172, 28)]:
        body += f'<circle class="gl" cx="{x}" cy="{y}" r="2.4" fill="#FFD27A"/>'
    write('art-lamps.svg', body, 240, 240, FLAME_DEFS, FLAME_STYLE)


def art_pongal():
    defs = (
        '<radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE9A6"/><stop offset=".7" stop-color="#FFBE3B"/>'
        '<stop offset="1" stop-color="#FF9A1F"/></radialGradient>'
        '<linearGradient id="pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E3F14"/><stop offset=".42" stop-color="#E39252"/>'
        '<stop offset=".7" stop-color="#C86B2E"/><stop offset="1" stop-color="#7E3510"/></linearGradient>'
        '<linearGradient id="cane" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3B1B43"/><stop offset=".5" stop-color="#93529F"/>'
        '<stop offset="1" stop-color="#3B1B43"/></linearGradient>' + LEAF_DEFS
    )
    style = ('@keyframes bub{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}.foam{animation:bub 2.6s ease-in-out infinite}'
             '@keyframes rot{to{transform:rotate(360deg)}}.rays{transform-origin:120px 86px;animation:rot 40s linear infinite}'
             '@keyframes steam{0%{opacity:0;transform:translateY(6px)}40%{opacity:.7}100%{opacity:0;transform:translateY(-16px)}}'
             '.st{animation:steam 3s ease-out infinite}.st2{animation-delay:-1s}.st3{animation-delay:-2s}')
    rays = ''.join(
        f'<path d="M120 86 L{f(120 + math.cos(a) * 82)} {f(86 + math.sin(a) * 82)} L{f(120 + math.cos(a + .1) * 82)} {f(86 + math.sin(a + .1) * 82)}Z" fill="#FFC94D" opacity=".5"/>'
        for a in [i * math.pi / 9 for i in range(18)]
    )
    body = f'<g class="rays">{rays}</g><circle cx="120" cy="86" r="44" fill="url(#sun)"/>'
    # sugarcanes standing either side, leaning out, with leaves at the top
    for (x0, x1, side) in [(70, 34, -1), (170, 206, 1)]:
        body += f'<path d="M{x0} 226 L{x1} 44" stroke="url(#cane)" stroke-width="10" stroke-linecap="round"/>'
        for t in [0.18, 0.36, 0.54, 0.72]:
            px = x0 + (x1 - x0) * t
            py = 226 - 182 * t
            body += f'<path d="M{f(px - 6)} {f(py)} h12" stroke="#2A1230" stroke-width="2"/>'
        for ang, ln, alt in [(-25, 52, False), (20, 48, True), (side * 70, 44, False), (side * -60, 40, True)]:
            body += f'<g transform="translate({x1} 46) rotate({180 + ang})">{mango_leaf(0, 0, ln, 0, alt)}</g>'
    body += '<ellipse cx="120" cy="226" rx="76" ry="9" fill="#000" opacity=".16"/>'
    # pot
    body += ('<path d="M92 128 C60 140 46 166 50 188 C55 214 84 226 120 226 C156 226 185 214 190 188 C194 166 180 140 148 128 Z" fill="url(#pot)"/>'
             '<path d="M86 118 H154 C156 122 156 128 150 131 H90 C84 128 84 122 86 118Z" fill="#B65A26"/>'
             '<ellipse cx="120" cy="118" rx="35" ry="6" fill="#6E2E0E"/>')
    # kolam band with red dots
    body += '<path d="M52 176 Q120 196 188 176" stroke="#FBF2DD" stroke-width="7" fill="none" stroke-linecap="round"/>'
    for i in range(9):
        t = (i + 0.5) / 9
        x = 52 + 136 * t
        y = 176 + math.sin(t * math.pi) * 10
        body += f'<circle cx="{f(x)}" cy="{f(y)}" r="2.2" fill="#C0392B"/>'
    body += '<path d="M60 160 Q120 172 180 160" stroke="#F3C13A" stroke-width="2" fill="none" stroke-dasharray="4 4"/>'
    # turmeric leaves tied at the neck
    body += mango_leaf(92, 131, 34, 35, True) + mango_leaf(148, 131, 34, -35)
    body += '<path d="M88 131 Q120 140 152 131" stroke="#F4C430" stroke-width="3" fill="none"/>'
    # boiling over
    body += ('<g class="foam"><path d="M84 120 C78 104 94 92 104 98 C106 84 124 80 130 92 C138 84 156 92 152 104 C162 106 162 120 156 122 '
             'C158 132 154 142 150 146 C146 140 146 132 142 128 L98 128 C96 134 94 142 90 148 C86 140 84 130 84 120Z" fill="#FFFDF6"/>'
             '<circle cx="106" cy="100" r="3" fill="#FFF"/><circle cx="134" cy="96" r="2.5" fill="#FFF"/><circle cx="120" cy="90" r="2" fill="#FFF"/>'
             '<circle cx="112" cy="108" r="1.6" fill="#EADBB5"/><circle cx="128" cy="110" r="1.6" fill="#EADBB5"/><circle cx="140" cy="104" r="1.6" fill="#EADBB5"/></g>')
    for i, x in enumerate([104, 120, 136]):
        body += f'<path class="st st{i + 1}" d="M{x} 78 c-6 -8 6 -14 0 -22" stroke="#FFF7E6" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>'
    write('art-pongal.svg', body, 240, 240, defs, style)


def art_kalash():
    defs = (
        '<linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9C6B12"/><stop offset=".35" stop-color="#F4D27A"/>'
        '<stop offset=".6" stop-color="#D9A632"/><stop offset="1" stop-color="#8A5A0C"/></linearGradient>'
        '<radialGradient id="coco" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#B07A44"/><stop offset="1" stop-color="#5A3418"/></radialGradient>'
        + LEAF_DEFS + MARIGOLD_DEFS
    )
    style = '@keyframes sh{0%,100%{opacity:.0}50%{opacity:.55}}.shine{animation:sh 3.2s ease-in-out infinite}'
    body = '<ellipse cx="120" cy="214" rx="64" ry="9" fill="#000" opacity=".15"/>'
    # leaves fanning out
    for a, alt in [(-62, False), (-32, True), (0, False), (32, True), (62, False)]:
        body += f'<g transform="translate(120 104) rotate(180)">{mango_leaf(0, 0, 70, a, alt)}</g>'
    # coconut
    body += '<ellipse cx="120" cy="84" rx="26" ry="30" fill="url(#coco)"/>'
    body += '<path d="M112 56 Q120 40 128 56 Q122 50 120 58 Q118 50 112 56Z" fill="#7A5230"/>'
    body += '<path d="M104 92 Q120 100 136 92" stroke="#E8B04B" stroke-width="2" fill="none" opacity=".7"/>'
    # pot
    body += '<path d="M92 110 H148 L142 124 H98Z" fill="url(#brass)"/>'
    body += '<path d="M98 124 Q60 150 70 180 Q80 214 120 214 Q160 214 170 180 Q180 150 142 124Z" fill="url(#brass)"/>'
    body += '<path d="M80 150 Q120 162 160 150" stroke="#B8860B" stroke-width="2" fill="none"/>'
    body += '<path d="M76 176 Q120 190 164 176" stroke="#B8860B" stroke-width="2" fill="none"/>'
    # kumkum & sandal marks
    body += '<rect x="113" y="158" width="14" height="24" rx="3" fill="#FFF3D6"/><rect x="117" y="162" width="6" height="16" rx="2" fill="#C0392B"/>'
    body += '<path class="shine" d="M88 140 Q84 164 96 196" stroke="#FFF7DC" stroke-width="5" fill="none" stroke-linecap="round"/>'
    # flower string at the neck
    for i in range(8):
        x = 96 + i * 6.9
        body += marigold(x, 124 + math.sin(i / 7 * math.pi) * 4, 4.4, yellow=i % 2 == 0)
    write('art-kalash.svg', body, 240, 240, defs, style)


def art_xmas():
    defs = (
        '<linearGradient id="tree" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E8B57"/><stop offset="1" stop-color="#14532D"/></linearGradient>'
        '<radialGradient id="starg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFF6C8"/><stop offset="1" stop-color="#F2C14E" stop-opacity="0"/></radialGradient>'
    )
    style = '@keyframes tw{0%,100%{opacity:1}50%{opacity:.35}}.b{animation:tw 2s ease-in-out infinite}.b2{animation-delay:-.7s}.b3{animation-delay:-1.4s}'
    body = '<ellipse cx="120" cy="214" rx="70" ry="9" fill="#000" opacity=".15"/>'
    body += '<rect x="110" y="186" width="20" height="26" fill="#6D4C41"/>'
    for (top, half, y) in [(40, 46, 104), (78, 62, 150), (116, 78, 196)]:
        body += f'<path d="M120 {top} L{120 + half} {y} Q120 {y + 10} {120 - half} {y}Z" fill="url(#tree)"/>'
    body += '<path d="M84 118 Q120 132 160 112 M66 164 Q120 182 178 158" stroke="#F2C14E" stroke-width="2.5" fill="none"/>'
    for i, (x, y, c) in enumerate([(98, 96, '#E63946'), (140, 92, '#F2C14E'), (86, 140, '#4CC9F0'), (152, 136, '#E63946'),
                                   (120, 120, '#F2C14E'), (72, 184, '#F2C14E'), (168, 182, '#4CC9F0'), (110, 166, '#E63946'), (140, 170, '#F2C14E')]):
        body += f'<circle class="b b{i % 3 + 1}" cx="{x}" cy="{y}" r="5" fill="{c}"/>'
    body += '<circle cx="120" cy="36" r="26" fill="url(#starg)"/>'
    pts = ' '.join(f'{f(120 + math.cos(-math.pi / 2 + i * math.pi / 5) * (14 if i % 2 == 0 else 6))},{f(36 + math.sin(-math.pi / 2 + i * math.pi / 5) * (14 if i % 2 == 0 else 6))}' for i in range(10))
    body += f'<polygon points="{pts}" fill="#F2C14E"/>'
    for (x, w, c) in [(46, 34, '#E63946'), (164, 30, '#2A9D8F')]:
        body += f'<rect x="{x}" y="{214 - w}" width="{w}" height="{w}" rx="3" fill="{c}"/><path d="M{x + w / 2} {214 - w} v{w} M{x} {214 - w / 2} h{w}" stroke="#F2C14E" stroke-width="4"/>'
    write('art-xmas.svg', body, 240, 240, defs, style)


def art_newyear():
    style = ('@keyframes pop{0%{transform:scale(.2);opacity:0}30%{opacity:1}100%{transform:scale(1);opacity:0}}'
             '.fw{transform-box:fill-box;transform-origin:center;animation:pop 2.8s ease-out infinite}.fw2{animation-delay:-1s}.fw3{animation-delay:-1.9s}')
    body = ''
    for cls, (cx, cy, r, c) in [('fw', (80, 90, 56, '#F2C14E')), ('fw fw2', (168, 70, 46, '#FF6B9A')), ('fw fw3', (150, 160, 40, '#4CC9F0'))]:
        rays = ''
        for i in range(16):
            a = i * math.pi / 8
            rays += (f'<path d="M{f(cx + math.cos(a) * r * .25)} {f(cy + math.sin(a) * r * .25)} L{f(cx + math.cos(a) * r)} {f(cy + math.sin(a) * r)}" '
                     f'stroke="{c}" stroke-width="3" stroke-linecap="round"/>'
                     f'<circle cx="{f(cx + math.cos(a) * (r + 7))}" cy="{f(cy + math.sin(a) * (r + 7))}" r="2.6" fill="{c}"/>')
        body += f'<g class="{cls}">{rays}</g>'
    for (x, y) in [(40, 190), (200, 200), (120, 30), (30, 40)]:
        body += f'<path d="M{x} {y - 8} L{x + 2} {y - 2} L{x + 8} {y} L{x + 2} {y + 2} L{x} {y + 8} L{x - 2} {y + 2} L{x - 8} {y} L{x - 2} {y - 2}Z" fill="#FFE29A"/>'
    write('art-newyear.svg', body, 240, 240, '', style)


def art_crescent():
    defs = (
        '<linearGradient id="moon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE7A3"/><stop offset="1" stop-color="#D9A632"/></linearGradient>'
        '<mask id="cm"><rect width="240" height="240" fill="#fff"/><circle cx="118" cy="82" r="52" fill="#000"/></mask>'
        '<linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#9C6B12"/><stop offset=".5" stop-color="#F2CF6B"/><stop offset="1" stop-color="#9C6B12"/></linearGradient>'
        '<radialGradient id="lglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFE9A8"/><stop offset="1" stop-color="#FFB703" stop-opacity="0"/></radialGradient>'
    )
    style = '@keyframes sw{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}.l{transform-box:fill-box;transform-origin:50% 0;animation:sw 4s ease-in-out infinite}@keyframes tw{0%,100%{opacity:1}50%{opacity:.3}}.s{animation:tw 2.4s infinite}'
    body = '<circle cx="96" cy="100" r="62" fill="url(#moon)" mask="url(#cm)"/>'
    body += '<path class="s" d="M150 60 l4 9 10 1-7.6 6.6 2.3 9.9-8.7-5.2-8.7 5.2 2.3-9.9-7.6-6.6 10-1z" fill="#FFE7A3"/>'
    x, y = 176, 96
    body += (f'<g class="l"><path d="M{x} 20 V{y}" stroke="#B8860B" stroke-width="1.5"/>'
             f'<circle cx="{x}" cy="{y + 36}" r="34" fill="url(#lglow)"/>'
             f'<path d="M{x - 9} {y} h18 l5 10 h-28z" fill="url(#lg)"/>'
             f'<path d="M{x - 16} {y + 10} h32 c4 12 4 42 0 54 h-32 c-4-12-4-42 0-54z" fill="url(#lg)"/>'
             f'<path d="M{x - 10} {y + 16} h20 v42 h-20z" fill="#FFE6A1"/>'
             f'<path d="M{x} {y + 16} v42 M{x - 10} {y + 37} h20" stroke="#9C6B12" stroke-width="1.6"/>'
             f'<path d="M{x - 11} {y + 64} h22 l-5 8 h-12z" fill="url(#lg)"/></g>')
    for (sx, sy, r) in [(40, 190, 2.5), (60, 40, 2), (210, 210, 2), (130, 200, 2.5)]:
        body += f'<circle class="s" cx="{sx}" cy="{sy}" r="{r}" fill="#FFE7A3"/>'
    write('art-crescent.svg', body, 240, 240, defs, style)


def art_tricolor():
    style = '@keyframes wv{0%,100%{transform:translateX(0)}50%{transform:translateX(-6px)}}.w{animation:wv 3s ease-in-out infinite}.w2{animation-delay:-1s}.w3{animation-delay:-2s}'
    body = ''
    for i, (c, y) in enumerate([('#FF9933', 70), ('#FFFFFF', 112), ('#138808', 154)]):
        body += (f'<path class="w w{i + 1}" d="M10 {y} C60 {y - 30} 100 {y + 30} 150 {y} S220 {y - 26} 236 {y - 8} '
                 f'L236 {y + 24} C220 {y + 6} 200 {y + 34} 150 {y + 32} S60 {y - 2} 10 {y + 32}Z" fill="{c}" '
                 f'stroke="{"#E3DED2" if c == "#FFFFFF" else "none"}" stroke-width="1.2"/>')
    for (x, y) in [(40, 30), (200, 34), (120, 210), (30, 206)]:
        body += f'<path d="M{x} {y - 7} L{x + 2} {y - 2} L{x + 7} {y} L{x + 2} {y + 2} L{x} {y + 7} L{x - 2} {y + 2} L{x - 7} {y} L{x - 2} {y - 2}Z" fill="#E0B23A"/>'
    write('art-tricolor.svg', body, 240, 240, '', style)


def art_hearts():
    defs = ('<linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F06292"/><stop offset="1" stop-color="#AD1457"/></linearGradient>'
            '<linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF8A80"/><stop offset="1" stop-color="#D32F2F"/></linearGradient>')
    style = '@keyframes beat{0%,100%{transform:scale(1)}15%{transform:scale(1.08)}30%{transform:scale(.98)}45%{transform:scale(1.05)}}.hb{transform-box:fill-box;transform-origin:center;animation:beat 2.2s ease-in-out infinite}.hb2{animation-delay:-.4s}'
    body = f'<path class="hb" d="{heart_path(100, 60, 110)}" fill="url(#h1)"/>'
    body += f'<path class="hb hb2" d="{heart_path(160, 96, 72)}" fill="url(#h2)" opacity=".95"/>'
    for (x, y, a) in [(40, 190, 20), (70, 210, -30), (190, 200, 40), (210, 60, -10), (36, 70, 60)]:
        body += f'<ellipse cx="{x}" cy="{y}" rx="9" ry="5" transform="rotate({a} {x} {y})" fill="#C62828"/>'
    write('art-hearts.svg', body, 240, 240, defs, style)


# ---------------------------------------------------------------------------------------------
# Kolam tile used (as a CSS mask) behind banners and in the footer
# ---------------------------------------------------------------------------------------------
def kolam():
    s = 120
    body = '<g fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round">'
    # four petal loops around the centre dot and a diamond weave around them
    for a in range(4):
        body += f'<path transform="rotate({a * 90} 60 60)" d="M60 60 C46 46 46 26 60 18 C74 26 74 46 60 60Z"/>'
    body += '<path d="M60 4 L116 60 L60 116 L4 60Z"/>'
    body += '<path d="M60 30 C80 30 90 40 90 60 C90 80 80 90 60 90 C40 90 30 80 30 60 C30 40 40 30 60 30Z" stroke-dasharray="2 5"/>'
    for (x, y) in [(0, 0), (120, 0), (0, 120), (120, 120)]:
        body += f'<path d="M{x} {y} m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0"/>'
    body += '</g><g fill="#000">'
    for (x, y) in [(60, 60), (60, 34), (60, 86), (34, 60), (86, 60), (0, 0), (120, 0), (0, 120), (120, 120), (60, 0), (0, 60), (120, 60), (60, 120)]:
        body += f'<circle cx="{x}" cy="{y}" r="2.2"/>'
    body += '</g>'
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" width="{s}" height="{s}">{body}</svg>\n'
    with open(os.path.join(OUT, '..', 'kolam.svg'), 'w') as fh:
        fh.write(svg)


for fn in [garland_mango, garland_marigold, garland_lights, garland_tricolor, garland_lanterns, garland_hearts,
           art_diya, art_lamps, art_pongal, art_kalash, art_xmas, art_newyear, art_crescent, art_tricolor, art_hearts, kolam]:
    fn()
print('festive art written to', os.path.normpath(OUT))
