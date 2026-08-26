#!/usr/bin/env python3
"""Translate the complete Route Analysis resource without changing its key schema."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
LOCALES = [
    "zh-TW",
    "zh-CN",
    "ja-JP",
    "ko-KR",
    "es-ES",
    "pt-BR",
    "fr-FR",
    "de-DE",
    "it-IT",
    "nl-NL",
    "ru-RU",
    "ar-SA",
]
LANGUAGE_NAMES = {
    "zh-TW": "Traditional Chinese used in Taiwan",
    "zh-CN": "Simplified Chinese used in mainland China",
    "ja-JP": "Japanese",
    "ko-KR": "Korean",
    "es-ES": "Spanish used in Spain",
    "pt-BR": "Brazilian Portuguese",
    "fr-FR": "French",
    "de-DE": "German",
    "it-IT": "Italian",
    "nl-NL": "Dutch",
    "ru-RU": "Russian",
    "ar-SA": "Modern Standard Arabic",
}


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def placeholders(value: str) -> list[str]:
    import re

    return sorted(re.findall(r"\{\{[^{}]+\}\}", value))


def schema_for(keys: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {key: {"type": "string"} for key in keys},
        "required": keys,
        "additionalProperties": False,
    }


def translate(client: OpenAI, locale: str, source: dict[str, str]) -> dict[str, str]:
    keys = list(source)
    response = client.chat.completions.create(
        model="gpt-5-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a precise cycling-app UI translator. Return only the requested JSON. "
                    "Translate naturally for a mobile UI, preserve every {{placeholder}}, units, numerical "
                    "symbols, abbreviations GPX/FTP/kcal, and all punctuation where it has semantic meaning."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Translate every value to {LANGUAGE_NAMES[locale]}. Do not return English fallbacks. "
                    "Use concise, professional cycling terminology. Source JSON:\n"
                    + json.dumps(source, ensure_ascii=False)
                ),
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": f"routes_{locale.replace('-', '_')}",
                "strict": True,
                "schema": schema_for(keys),
            },
        },
    )
    result = json.loads(response.choices[0].message.content)
    if set(result) != set(source):
        raise ValueError(f"{locale}: translated key set differs from routes schema")
    for key, original in source.items():
        translated = result[key]
        if not isinstance(translated, str) or not translated.strip():
            raise ValueError(f"{locale}.{key}: empty translation")
        if placeholders(translated) != placeholders(original):
            raise ValueError(f"{locale}.{key}: interpolation mismatch")
    return result


def main() -> None:
    english_path = ROOT / "lib/i18n/locales/en-US.json"
    source = load(english_path)["routes"]
    client = OpenAI()
    for locale in LOCALES:
        path = ROOT / f"lib/i18n/locales/{locale}.json"
        document = load(path)
        document["routes"] = translate(client, locale, source)
        path.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"updated {locale}: {len(source)} route-analysis strings")


if __name__ == "__main__":
    main()
