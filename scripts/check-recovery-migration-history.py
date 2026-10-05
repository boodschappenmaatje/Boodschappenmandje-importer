#!/usr/bin/env python3
"""Fail-closed history checks for the one-migration Production runner."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path


TARGET_VERSION = "20261005220000"
TARGET_FILENAME = "20261005220000_recover_failed_daily_catalog_growth.sql"
VERSION_RE = re.compile(r"^[0-9]{14}$")
TIME_RE = re.compile(r"^[0-9 :\-]+$")


class ValidationError(Exception):
    """A safe, non-secret validation failure."""


def local_versions(migration_dir: Path) -> set[str]:
    files = sorted(migration_dir.glob("*.sql"))
    if not files:
        raise ValidationError("local migration directory is empty")

    versions: list[str] = []
    target_files: list[str] = []
    for path in files:
        match = re.fullmatch(r"([0-9]{14})_.+\.sql", path.name)
        if match is None:
            raise ValidationError("local migration filename format differs")
        version = match.group(1)
        versions.append(version)
        if version == TARGET_VERSION:
            target_files.append(path.name)

    if Counter(versions).most_common(1)[0][1] != 1:
        raise ValidationError("local migration version is duplicated")
    if target_files != [TARGET_FILENAME]:
        raise ValidationError("the exact target migration file is not present once")
    return set(versions)


def read_rows(list_path: Path) -> list[dict[str, object]]:
    try:
        payload = json.loads(list_path.read_text(encoding="utf-8"))
        rows = payload["migrations"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError):
        raise ValidationError("migration list output is not valid JSON") from None
    if not isinstance(rows, list) or not rows:
        raise ValidationError("migration list is empty or malformed")
    return rows


def validate_history(rows: list[dict[str, object]], expected_local: set[str], phase: str) -> None:
    local: list[str] = []
    remote: list[str] = []
    local_only: set[str] = set()
    remote_only: set[str] = set()
    matched: set[str] = set()

    for row in rows:
        if not isinstance(row, dict):
            raise ValidationError("migration list row is malformed")
        local_value = row.get("local", "")
        remote_value = row.get("remote", "")
        time_value = row.get("time", "")
        if local_value is None:
            local_value = ""
        if remote_value is None:
            remote_value = ""
        if not isinstance(local_value, str) or not isinstance(remote_value, str):
            raise ValidationError("migration list version type differs")
        if not isinstance(time_value, str) or (time_value and not TIME_RE.fullmatch(time_value)):
            raise ValidationError("migration list time format differs")
        if (local_value and not VERSION_RE.fullmatch(local_value)) or (
            remote_value and not VERSION_RE.fullmatch(remote_value)
        ):
            raise ValidationError("migration list version format differs")
        if not local_value and not remote_value:
            raise ValidationError("migration list contains an empty row")

        if local_value:
            local.append(local_value)
        if remote_value:
            remote.append(remote_value)
        if local_value and remote_value:
            if local_value != remote_value:
                raise ValidationError("local and remote versions are misaligned")
            matched.add(local_value)
        elif local_value:
            local_only.add(local_value)
        else:
            remote_only.add(remote_value)

    if len(local) != len(set(local)) or set(local) != expected_local:
        raise ValidationError("listed local versions differ from repository files")
    if len(remote) != len(set(remote)):
        raise ValidationError("listed remote versions are duplicated")

    expected_remote = expected_local - {TARGET_VERSION}
    if phase == "precheck":
        if set(remote) != expected_remote:
            raise ValidationError("remote history differs from the expected baseline")
        if local_only != {TARGET_VERSION} or remote_only or matched != expected_remote:
            raise ValidationError("precheck is not exactly one target migration local-only")
        print("PRECHECK_VALID_ONE_PENDING")
        return

    if phase == "postcheck":
        if set(remote) != expected_local:
            raise ValidationError("postcheck remote history differs from local files")
        if local_only or remote_only or matched != expected_local:
            raise ValidationError("postcheck is not a complete local-remote match")
        print("POSTCHECK_VALID_EXACT_MATCH")
        return

    raise ValidationError("unknown validation phase")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=("precheck", "postcheck"), required=True)
    parser.add_argument("--migration-dir", type=Path, required=True)
    parser.add_argument("--list-json", type=Path, required=True)
    args = parser.parse_args()

    try:
        validate_history(read_rows(args.list_json), local_versions(args.migration_dir), args.phase)
        return 0
    except ValidationError as error:
        print(f"Recovery migration history failed closed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
