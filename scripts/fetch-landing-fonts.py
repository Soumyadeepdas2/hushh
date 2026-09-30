
"""
Fetch the landing-page fonts and write them into public/fonts/ as woff2.

Self-hosted on purpose: hushh is a privacy product, so the landing page should
not make third-party font requests to Google. Two variable fonts, latin subset:

  shantell-sans.woff2  — the headline face (hand-drawn marker feel)
  nunito.woff2         — landing body / labels / chat card

Run from the project root:  python3 scripts/fetch-landing-fonts.py
"""
import os
import re
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

OUT_DIR = os.path.join("public", "fonts")
TARGETS = {
    "shantell-sans.woff2": "Shantell+Sans:wght@300..800",
    "nunito.woff2": "Nunito:wght@400..800",
}

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=60).read()

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for filename, query in TARGETS.items():
        css = get(f"https://fonts.googleapis.com/css2?family={query}&display=swap").decode()
        picked = None
        for block in re.findall(r"@font-face\s*\{(.*?)\}", css, re.S):
            ur = re.search(r"unicode-range:\s*([^;]+);", block)
            if not ur or "U+0000-00FF" not in ur.group(1):
                continue
            picked = re.search(r"url\((https://[^)]+)\)", block).group(1).replace("&amp;", "&")
            break
        if not picked:
            raise SystemExit(f"could not find a latin @font-face for {filename}")
        data = get(picked)
        if data[:4] != b"wOF2":
            raise SystemExit(f"{filename}: upstream did not return woff2")
        path = os.path.join(OUT_DIR, filename)
        open(path, "wb").write(data)
        print(f"  {filename:22s} {len(data)/1024:6.1f} KB  <- {picked[:72]}")
    print("\nfonts written to", OUT_DIR)

if __name__ == "__main__":
    main()
