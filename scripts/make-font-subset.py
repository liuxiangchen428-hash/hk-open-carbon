#!/usr/bin/env python3
"""Cut Noto Sans TC down to the characters the site uses, as WOFF2.

The site prefers each device's own system font (PingFang on Apple devices);
this subset is only downloaded where that font is missing, e.g. Windows.

Usage:
  pip install fonttools brotli
  python3 scripts/make-font-subset.py <folder containing NotoSansTC_400Regular.ttf and NotoSansTC_700Bold.ttf, e.g. an unpacked @expo-google-fonts/noto-sans-tc>

Run `npm run site` first: the character list is read from site-dist/ (pages, scripts, data).
Re-run when new text adds characters; any missing character falls back to the system font.
The font is under the SIL Open Font License 1.1 (site/assets/fonts/OFL.txt).
"""
import pathlib, sys
from fontTools import subset

root = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1])
dist = root / 'site-dist'
text = ''
for p in list(dist.glob('*.html')) + list((dist / 'assets').glob('*.js')) + list((dist / 'assets').glob('*.json')):
    text += p.read_text(encoding='utf-8')
chars = {c for c in text if ord(c) >= 0x20}
# Always keep basic Latin, Latin-1, general punctuation, CJK punctuation and full-width forms.
for a, b in [(0x20, 0x7E), (0xA0, 0xFF), (0x2000, 0x206F), (0x3000, 0x303F), (0xFF00, 0xFFEF), (0x2070, 0x209F)]:
    chars.update(chr(i) for i in range(a, b + 1))
out = root / 'site' / 'assets' / 'fonts'
out.mkdir(exist_ok=True)
for weight, name in [(400, 'NotoSansTC_400Regular.ttf'), (700, 'NotoSansTC_700Bold.ttf')]:
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    path = next(src.rglob(name))
    font = subset.load_font(str(path), opts)
    s = subset.Subsetter(opts)
    s.populate(text=''.join(sorted(chars)))
    s.subset(font)
    dest = out / f'hkoc-sans-{weight}.woff2'
    subset.save_font(font, str(dest), opts)
    print(f'{dest.relative_to(root)}: {dest.stat().st_size // 1024} KB, {len(chars)} characters')
