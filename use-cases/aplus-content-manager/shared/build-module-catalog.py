#!/usr/bin/env python3
"""Derive shared/module-catalog.json from the A+ Content OpenAPI model.

For every ContentModuleType the catalog records the wrapper key on ContentModule, the module
definition's fields (type, required, ref) recursively down to the component level, so the editor
can render forms and the preview can render modules without hand-maintained schemas.

    python3 shared/build-module-catalog.py path/to/aplusContent_2020-11-01.json

The model is published at
https://github.com/amzn/selling-partner-api-models/blob/main/models/aplus-content-api-model/aplusContent_2020-11-01.json
"""
import json
import sys
from pathlib import Path

model = json.load(open(sys.argv[1]))
D = model["definitions"]
COMPONENTS = {"TextComponent", "ParagraphComponent", "ImageComponent", "VideoComponent", "Asin", "ColorType", "PositionType", "IntegerWithUnits"}
ENUMS = {n: d["enum"] for n, d in D.items() if "enum" in d}


def ref(v):
    r = v.get("$ref") or (v.get("items") or {}).get("$ref")
    return r.split("/")[-1] if r else None


def field(name, spec, required):
    r = ref(spec)
    out = {"name": name, "required": name in required}
    if spec.get("type") == "array":
        out["type"] = "array"
        out["maxItems"] = spec.get("maxItems")
        out["minItems"] = spec.get("minItems")
        out["item"] = r
        if r and r not in COMPONENTS and r in D:
            out["itemSchema"] = schema(r)
    elif r:
        out["type"] = r
        if r in ENUMS:
            out["enum"] = ENUMS[r]
        elif r not in COMPONENTS and r in D:
            out["schema"] = schema(r)
    else:
        out["type"] = spec.get("type", "object")
        for k in ("maxLength", "minLength", "minimum", "maximum"):
            if k in spec:
                out[k] = spec[k]
    return out


def schema(name, depth=0):
    d = D[name]
    req = d.get("required") or []
    return {"name": name, "fields": [field(k, v, req) for k, v in (d.get("properties") or {}).items()]}


cm = D["ContentModule"]["properties"]
catalog = []
for mtype in D["ContentModuleType"]["enum"]:
    # wrapper key: STANDARD_HEADER_IMAGE_TEXT -> standardHeaderImageText
    parts = mtype.lower().split("_")
    key = parts[0] + "".join(p.capitalize() for p in parts[1:])
    assert key in cm, (mtype, key)
    module_def = ref(cm[key])
    tier = "brandStory" if mtype.startswith("BRAND_STORY") else ("premium" if mtype.startswith("PREMIUM") else "standard")
    catalog.append({"type": mtype, "key": key, "tier": tier, "definition": module_def, "schema": schema(module_def)})

out = {
    "source": Path(sys.argv[1]).name,
    "contentTypes": ENUMS["ContentType"],
    "contentStatus": ENUMS["ContentStatus"],
    "contentBadges": ENUMS["ContentBadge"],
    "asinBadges": ENUMS["AsinBadge"],
    "modules": catalog,
}
Path(__file__).with_name("module-catalog.json").write_text(json.dumps(out, indent=2))
print(f"{len(catalog)} modules -> shared/module-catalog.json")
