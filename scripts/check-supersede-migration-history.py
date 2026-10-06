#!/usr/bin/env python3
"""Fail-closed exact-one history checks for the PR #51 runner."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

TARGET_VERSION = "20261005230000"
TARGET_FILENAME = "20261005230000_supersede_failed_daily_catalog_job.sql"
VERSION_RE = re.compile(r"^[0-9]{14}$")
TIME_RE = re.compile(r"^[0-9 :\-]+$")


class ValidationError(Exception):
    pass


def local_versions(directory: Path) -> set[str]:
    files = sorted(directory.glob("*.sql"))
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
    if any(count != 1 for count in Counter(versions).values()):
        raise ValidationError("local migration version is duplicated")
    if target_files != [TARGET_FILENAME]:
        raise ValidationError("exact target migration file is not present once")
    return set(versions)


def rows(path: Path) -> list[dict[str, object]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        result = value["migrations"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError):
        raise ValidationError("migration list output is not valid JSON") from None
    if not isinstance(result, list) or not result:
        raise ValidationError("migration list is empty or malformed")
    return result


def validate(history: list[dict[str, object]], expected: set[str], phase: str) -> None:
    local: list[str] = []
    remote: list[str] = []
    local_only: set[str] = set()
    remote_only: set[str] = set()
    matched: set[str] = set()
    for row in history:
        if not isinstance(row, dict):
            raise ValidationError("migration list row is malformed")
        left = row.get("local", "") or ""
        right = row.get("remote", "") or ""
        timestamp = row.get("time", "") or ""
        if not isinstance(left, str) or not isinstance(right, str) or not isinstance(timestamp, str):
            raise ValidationError("migration list field type differs")
        if timestamp and not TIME_RE.fullmatch(timestamp):
            raise ValidationError("migration list time format differs")
        if (left and not VERSION_RE.fullmatch(left)) or (right and not VERSION_RE.fullmatch(right)):
            raise ValidationError("migration list version format differs")
        if not left and not right:
            raise ValidationError("migration list contains an empty row")
        if left:
            local.append(left)
        if right:
            remote.append(right)
        if left and right:
            if left != right:
                raise ValidationError("local and remote versions are misaligned")
            matched.add(left)
        elif left:
            local_only.add(left)
        else:
            remote_only.add(right)
    if len(local) != len(set(local)) or set(local) != expected:
        raise ValidationError("listed local versions differ from repository files")
    if len(remote) != len(set(remote)):
        raise ValidationError("listed remote versions are duplicated")
    if phase == "precheck":
        baseline = expected - {TARGET_VERSION}
        if set(remote) != baseline or local_only != {TARGET_VERSION} or remote_only or matched != baseline:
            raise ValidationError("precheck is not exactly one target migration local-only")
        print("PRECHECK_VALID_ONE_PENDING")
    elif phase == "postcheck":
        if set(remote) != expected or local_only or remote_only or matched != expected:
            raise ValidationError("postcheck is not a complete local-remote match")
        print("POSTCHECK_VALID_EXACT_MATCH")
    else:
        raise ValidationError("unknown validation phase")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=("precheck", "postcheck"), required=True)
    parser.add_argument("--migration-dir", type=Path, required=True)
    parser.add_argument("--list-json", type=Path, required=True)
    args = parser.parse_args()
    try:
        validate(rows(args.list_json), local_versions(args.migration_dir), args.phase)
        return 0
    except ValidationError as error:
        print(f"Supersede migration history failed closed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
