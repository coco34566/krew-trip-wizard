from pathlib import Path

p = Path("src/components/krew/TransportTimePrefsCard.tsx")
s = p.read_text()
needle = 'import { KrewStatefulButton } from "@/components/krew/KrewStatefulButton";\n'
icon_import = 'import { KrewIcon } from "@/components/krew/visual-language/KrewIcon";\n'
if icon_import not in s:
    if needle not in s:
        raise SystemExit("TransportTimePrefsCard: stateful import not found")
    s = s.replace(needle, needle + icon_import, 1)
p.write_text(s)
