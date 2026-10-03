from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / "scripts/check-supabase-migration-history.py"
VERSIONS = [
    "20260908091354", "20260908110213", "20260908121109", "20260908222836",
    "20260914193340", "20260915151220", "20260915173523", "20260917092809",
    "20260919154657", "20260920213421", "20260920220220", "20260921104333",
    "20261002220202",
]
REMOTE = VERSIONS[8:]
BASELINE = VERSIONS[:8]


def rows_for(remote_versions: list[str]) -> list[dict[str, str]]:
    rows = [{"local": version, "remote": version, "time": "2026-10-03 00:00:00"}
            for version in REMOTE if version in remote_versions]
    rows.extend({"local": version, "remote": "", "time": ""} for version in BASELINE)
    rows.extend({"local": "", "remote": version, "time": "2026-10-03 00:00:00"}
                for version in remote_versions if version not in REMOTE)
    return rows


class MigrationHistoryGuardTests(unittest.TestCase):
    def run_checker(self, remote_versions: list[str], armed: str = "false") -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            migrations = directory / "migrations"
            migrations.mkdir()
            for version in VERSIONS:
                (migrations / f"{version}_fixture.sql").write_text("-- fixture\n", encoding="utf-8")
            list_path = directory / "migration-list.json"
            list_path.write_text(json.dumps({"migrations": rows_for(remote_versions)}), encoding="utf-8")
            return subprocess.run(
                [sys.executable, str(CHECKER), "--phase", "pre-repair", "--armed", armed,
                 "--migration-dir", str(migrations), "--list-json", str(list_path)],
                text=True, capture_output=True, check=False,
            )

    def test_disarmed_exact_mapping_never_enters_repair_state(self) -> None:
        result = self.run_checker(REMOTE, "false")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "PRECHECK_VALID_DISARMED")

    def test_wrong_remote_history_fails_closed(self) -> None:
        result = self.run_checker(REMOTE[:-1] + ["20990101000000"])
        self.assertNotEqual(result.returncode, 0)

    def test_baseline_version_already_remote_fails_closed(self) -> None:
        result = self.run_checker(REMOTE + [BASELINE[0]])
        self.assertNotEqual(result.returncode, 0)

    def test_missing_existing_remote_version_fails_closed(self) -> None:
        result = self.run_checker(REMOTE[:-1])
        self.assertNotEqual(result.returncode, 0)

    def test_exact_mapping_reaches_only_armed_precheck_state(self) -> None:
        result = self.run_checker(REMOTE, "true")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "PRECHECK_VALID_REPAIR_ARMED")

    def test_dry_run_requires_explicit_up_to_date_result(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "dry-run.txt"
            output.write_text("Remote database is up to date.\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(CHECKER), "--phase", "dry-run", "--dry-run-output", str(output)],
                text=True, capture_output=True, check=False,
            )
            self.assertEqual(result.returncode, 0)
            output.write_text("Remote database is up to date. Would push these migrations:\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(CHECKER), "--phase", "dry-run", "--dry-run-output", str(output)],
                text=True, capture_output=True, check=False,
            )
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
