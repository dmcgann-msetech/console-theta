from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGET_EXTS = {
    ".html",
    ".js",
    ".css",
    ".md",
    ".json",
}

SKIP_DIRS = {
    ".git",
    "node_modules",
    "backups",
    "__pycache__",
}

def looks_bad(text: str) -> bool:
    markers = ("â", "Â", "Ã", "ðŸ")
    return any(m in text for m in markers)

def repair_text(text: str) -> str:
    previous = None
    current = text

    for _ in range(3):
        if current == previous:
            break
        previous = current
        try:
            current = current.encode("latin1").decode("utf-8")
            continue
        except UnicodeError:
            pass
        try:
            current = current.encode("cp1252").decode("utf-8")
            continue
        except UnicodeError:
            pass
        break

    return current

def iter_files():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in TARGET_EXTS:
            continue
        yield path

def main():
    changed = 0
    scanned = 0

    for path in iter_files():
        scanned += 1

        try:
            original = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            print(f"SKIP non-utf8: {path.relative_to(ROOT)}")
            continue

        if not looks_bad(original):
            continue

        fixed = repair_text(original)

        if fixed != original and not looks_bad(fixed):
            path.write_text(fixed, encoding="utf-8", newline="\n")
            changed += 1
            print(f"FIXED: {path.relative_to(ROOT)}")
        elif fixed != original:
            path.write_text(fixed, encoding="utf-8", newline="\n")
            changed += 1
            print(f"PARTIAL: {path.relative_to(ROOT)}")
        else:
            print(f"UNCHANGED: {path.relative_to(ROOT)}")

    print()
    print(f"Scanned: {scanned}")
    print(f"Changed: {changed}")

if __name__ == "__main__":
    main()