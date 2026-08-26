#!/usr/bin/env python3
"""Translate one validated UI resource group without changing its key schema."""

from __future__ import annotations

import json
import os
import random
import re
import time
from urllib.parse import urlencode
from urllib.request import urlopen
from pathlib import Path
from typing import Any

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
RESOURCE_GROUP = "audit"
BATCH_SIZE = 12
MAX_ATTEMPTS = 4
TRANSLATION_PROVIDER = os.environ.get("TRANSLATION_PROVIDER", "model")
LANGUAGE_NEUTRAL_TECHNICAL_KEYS = {"elevationReadout"}
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


def translate_with_mymemory(locale: str, source: dict[str, str]) -> dict[str, str]:
    """Rate-limited fallback for transient model-proxy failures."""
    result: dict[str, str] = {}
    for key, value in source.items():
        if key in LANGUAGE_NEUTRAL_TECHNICAL_KEYS:
            result[key] = value
            continue
        protected = value
        tokens: list[str] = []
        for index, placeholder in enumerate(re.findall(r"\{\{[^{}]+\}\}", value)):
            token = f"I18NPHTOKEN{index}"
            protected = protected.replace(placeholder, token, 1)
            tokens.append(placeholder)
        params = urlencode({"q": protected, "langpair": f"en|{locale}"})
        last_error: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                with urlopen(
                    f"https://api.mymemory.translated.net/get?{params}", timeout=30
                ) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                translated = payload["responseData"]["translatedText"].strip()
                if not translated:
                    raise ValueError(f"{locale}.{key}: empty fallback translation")
                for index, placeholder in enumerate(tokens):
                    translated = re.sub(
                        rf"I18N\s*PH\s*TOKEN\s*{index}",
                        placeholder,
                        translated,
                        flags=re.IGNORECASE,
                    )
                if placeholders(translated) != placeholders(value):
                    raise ValueError(f"{locale}.{key}: fallback interpolation mismatch")
                result[key] = translated
                break
            except Exception as error:
                last_error = error
                if attempt == MAX_ATTEMPTS:
                    raise RuntimeError(
                        f"{locale}.{key}: fallback translation failed"
                    ) from last_error
                time.sleep((2 ** (attempt - 1)) + random.random())
        time.sleep(0.5)
    return result


def translate(client: OpenAI, locale: str, source: dict[str, str]) -> dict[str, str]:
    if TRANSLATION_PROVIDER == "mymemory":
        return translate_with_mymemory(locale, source)
    if len(source) > BATCH_SIZE:
        keys = list(source)
        merged: dict[str, str] = {}
        for start in range(0, len(keys), BATCH_SIZE):
            batch = {key: source[key] for key in keys[start : start + BATCH_SIZE]}
            merged.update(translate(client, locale, batch))
        return merged
    keys = list(source)
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = client.chat.completions.create(
                model="gpt-5-mini",
                max_completion_tokens=2_000,
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
                        "name": f"{RESOURCE_GROUP}_{locale.replace('-', '_')}",
                        "strict": True,
                        "schema": schema_for(keys),
                    },
                },
                extra_body={"reasoning": {"effort": "minimal"}},
            )
            content = response.choices[0].message.content
            if not content:
                raise ValueError(f"{locale}: empty model response")
            result = json.loads(content)
            if set(result) != set(source):
                raise ValueError(f"{locale}: translated key set differs from {RESOURCE_GROUP} schema")
            for key, original in source.items():
                translated = result[key]
                if not isinstance(translated, str) or not translated.strip():
                    raise ValueError(f"{locale}.{key}: empty translation")
                if placeholders(translated) != placeholders(original):
                    raise ValueError(f"{locale}.{key}: interpolation mismatch")
            return result
        except Exception as error:  # The proxy can return transient null content.
            last_error = error
            if attempt == MAX_ATTEMPTS:
                break
            delay = (2 ** (attempt - 1)) + random.random()
            print(f"retry {locale}, attempt {attempt}/{MAX_ATTEMPTS}: {error}")
            time.sleep(delay)
    raise RuntimeError(f"{locale}: translation failed after {MAX_ATTEMPTS} attempts") from last_error


def main() -> None:
    english_path = ROOT / "lib/i18n/locales/en-US.json"
    source = load(english_path)[RESOURCE_GROUP]
    client = OpenAI()
    for locale in LOCALES:
        path = ROOT / f"lib/i18n/locales/{locale}.json"
        document = load(path)
        existing = document.get(RESOURCE_GROUP)
        existing = existing if isinstance(existing, dict) else {}
        missing = {
            key: value
            for key, value in source.items()
            if not isinstance(existing.get(key), str)
            or not existing[key].strip()
            or placeholders(existing[key]) != placeholders(value)
        }
        if not missing and set(existing) == set(source):
            print(f"skipped {locale}: {RESOURCE_GROUP} schema already complete")
            continue
        translated = translate(client, locale, missing) if missing else {}
        document[RESOURCE_GROUP] = {
            key: translated[key] if key in translated else existing[key]
            for key in source
        }
        path.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"updated {locale}: {len(missing)} missing {RESOURCE_GROUP} strings")


if __name__ == "__main__":
    main()
