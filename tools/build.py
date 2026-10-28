import base64, hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = "Orvid sources"
KEY = os.environ.get("ORVID_SOURCES_KEY", os.path.expanduser("~/keys/orvid-sources.pem"))
SAFE = re.compile(r"^[A-Za-z0-9_\-]+\.(json|js|png|webp)$")


def public_key():
    der = subprocess.run(["openssl", "ec", "-in", KEY, "-pubout", "-outform", "DER"],
                         check=True, capture_output=True).stdout
    return base64.b64encode(der).decode()


def main():
    names = os.listdir(ROOT)
    files, sources = {}, []
    for f in sorted(names):
        if f in ("index.json", "index.sig") or not SAFE.match(f):
            continue
        body = open(os.path.join(ROOT, f), "rb").read()
        files[f] = hashlib.sha256(body).hexdigest()
        if f.endswith(".json"):
            d = json.loads(body)
            for field in (("id", "name") if "engine" in d or d.get("portal") else ("id", "name", "match")):
                if field not in d:
                    sys.exit(f"{f}: missing {field}")
            if "match" in d:
                re.compile(d["match"])
            for ref in (d.get("script"), d.get("icon")):
                if ref and ref not in names:
                    sys.exit(f"{f}: missing file {ref}")
            sources.append(f)
    index = {"name": NAME, "key": public_key(), "files": files, "sources": sources}
    others = os.path.join(ROOT, "tools", "repos.json")
    if os.path.exists(others):
        index["repos"] = json.load(open(others))
    raw = json.dumps(index, indent=1, sort_keys=True).encode()
    open(os.path.join(ROOT, "index.json"), "wb").write(raw)
    sig = subprocess.run(["openssl", "dgst", "-sha256", "-sign", KEY], input=raw, check=True, capture_output=True).stdout
    open(os.path.join(ROOT, "index.sig"), "w").write(base64.b64encode(sig).decode() + "\n")
    print(f"{NAME}: {len(sources)} sources, {len(files)} files")


if __name__ == "__main__":
    main()
