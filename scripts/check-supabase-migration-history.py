#!/usr/bin/env python3
"""Fail-closed validation for the temporary Production history workflow."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path


REMOTE_VERSIONS = {
    "20260919154657",
    "20260920213421",
    "20260920220220",
    "20260921104333",
    "20261002220202",
}
BASELINE_VERSIONS = {
    "20260908091354",
    "20260908110213",
    "20260908121109",
    "20260908222836",
    "20260914193340",
    "20260915151220",
    "20260915173523",
    "20260917092809",
}
LOCAL_VERSIONS = REMOTE_VERSIONS | BASELINE_VERSIONS
VERSION_RE = re.compile(r"^[0-9]{14}$")


class ValidationError(Exception):
    pass


def validate_local_files(migration_dir: Path) -> None:
    files = sorted(migration_dir.glob("*.sql"))
    versions: list[str] = []
    for path in files:
        match = re.fullmatch(r"([0-9]{14})_.+\.sql", path.name)
        if not match:
            raise ValidationError("local migration filename format differs")
        versions.append(match.group(1))
    counts = Counter(versions)
    if any(count != 1 for count in counts.values()):
        raise ValidationError("local migration version is duplicated")
    if set(versions) != LOCAL_VERSIONS or len(versions) != len(LOCAL_VERSIONS):
        raise ValidationError("local migration version set differs")


def read_rows(list_path: Path) -> list[dict[str, object]]:
    try:
        payload = json.loads(list_path.read_text(encoding="utf-8"))
        rows = payload["migrations"]
    except (OSError, json.JSONDecodeError, KeyError, TypeError):
        raise ValidationError("migration list output is not valid JSON") from None
    if not isinstance(rows, list) or not rows:
        raise ValidationError("migration list is empty or malformed")
    return rows


def validate_history(rows: list[dict[str, object]], phase: str) -> None:
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
        if local_value is None:
            local_value = ""
        if remote_value is None:
            remote_value = ""
        if not isinstance(local_value, str) or not isinstance(remote_value, str):
            raise ValidationError("migration list version type differs")
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

    if len(local) != len(set(local)) or set(local) != LOCAL_VERSIONS:
        raise ValidationError("listed local versions differ")
    if len(remote) != len(set(remote)):
        raise ValidationError("listed remote versions are duplicated")

    if phase == "pre-repair":
        if set(remote) != REMOTE_VERSIONS:
            raise ValidationError("remote migration history differs from expected baseline")
        if matched != REMOTE_VERSIONS or local_only != BASELINE_VERSIONS or remote_only:
            raise ValidationError("local-to-remote pre-repair mapping differs")
    elif phase == "post-repair":
        if set(remote) != LOCAL_VERSIONS:
            raise ValidationError("post-repair remote versions differ")
        if matched != LOCAL_VERSIONS or local_only or remote_only:
            raise ValidationError("post-repair history is not fully aligned")
    else:
        raise ValidationError("unknown validation phase")


def validate_dry_run(output_path: Path) -> None:
    try:
        output = output_path.read_text(encoding="utf-8").lower()
    except OSError:
        raise ValidationError("dry-run output could not be read") from None
    if "remote database is up to date" not in output:
        raise ValidationError("dry-run did not confirm an up-to-date database")
    if re.search(r"\b(would push|would apply|pending migration|migrations? to apply)\b", output):
        raise ValidationError("dry-run indicates pending migrations")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=("pre-repair", "post-repair", "dry-run"), required=True)
    parser.add_argument("--migration-dir", type=Path)
    parser.add_argument("--list-json", type=Path)
    parser.add_argument("--dry-run-output", type=Path)
    parser.add_argument("--armed", choices=("true", "false"), default="false")
    args = parser.parse_args()

    try:
        if args.phase == "dry-run":
            if args.dry_run_output is None:
                raise ValidationError("dry-run output path is required")
            validate_dry_run(args.dry_run_output)
            print("DRY_RUN_NO_MIGRATIONS")
            return 0

        if args.migration_dir is None or args.list_json is None:
            raise ValidationError("migration directory and list output are required")
        validate_local_files(args.migration_dir)
        validate_history(read_rows(args.list_json), args.phase)
        if args.phase == "pre-repair" and args.armed == "false":
            print("PRECHECK_VALID_DISARMED")
        else:
            print("PRECHECK_VALID_REPAIR_ARMED")
        return 0
    except ValidationError as error:
        print(f"History validation failed closed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
