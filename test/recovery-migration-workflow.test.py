from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/apply-recovery-migration.yml"
CHECKER = ROOT / "scripts/check-recovery-migration-history.py"
TARGET_VERSION = "20261005220000"
TARGET_FILENAME = "20261005220000_recover_failed_daily_catalog_growth.sql"
LOCAL_VERSIONS = sorted(
    path.name.split("_", 1)[0]
    for path in (ROOT / "supabase/migrations").glob("*.sql")
)


def rows_for(local_versions: list[str], remote_versions: list[str]) -> list[dict[str, str]]:
    remote_set = set(remote_versions)
    rows = [
        {"local": version, "remote": version, "time": "2026-10-05 00:00:00"}
        for version in local_versions
        if version in remote_set
    ]
    rows.extend(
        {"local": version, "remote": "", "time": ""}
        for version in local_versions
        if version not in remote_set
    )
    rows.extend(
        {"local": "", "remote": version, "time": "2026-10-05 00:00:00"}
        for version in remote_versions
        if version not in local_versions
    )
    return rows


class RecoveryMigrationWorkflowTests(unittest.TestCase):
    def run_checker(self, local_versions: list[str], remote_versions: list[str], phase: str) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            migrations = directory / "migrations"
            migrations.mkdir()
            for version in local_versions:
                filename = TARGET_FILENAME if version == TARGET_VERSION else f"{version}_fixture.sql"
                (migrations / filename).write_text("-- fixture\n", encoding="utf-8")
            list_path = directory / "migration-list.json"
            list_path.write_text(json.dumps({"migrations": rows_for(local_versions, remote_versions)}), encoding="utf-8")
            return subprocess.run(
                [sys.executable, str(CHECKER), "--phase", phase, "--migration-dir", str(migrations), "--list-json", str(list_path)],
                text=True,
                capture_output=True,
                check=False,
            )

    def test_workflow_is_valid_yaml_and_exactly_scoped(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        parsed = yaml.safe_load(workflow)
        self.assertIsInstance(parsed, dict)
        self.assertIn("jobs", parsed)
        self.assertIn("MIGRATION_ARMED: 'false'", workflow)
        self.assertIn("refs/heads/codex/recover-failed-daily-attention-20261005", workflow)
        self.assertIn("20261005220000_recover_failed_daily_catalog_growth.sql", workflow)
        self.assertIn("supabase/setup-cli", workflow)
        self.assertIn("version: 2.119.0", workflow)
        self.assertIn("supabase migration list", workflow)
        self.assertIn("supabase db push", workflow)
        self.assertIn("--db-url", workflow)

    def test_write_job_requires_fresh_armed_precheck_and_true_guard(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("needs.precheck.outputs.precheck_passed == 'true'", workflow)
        self.assertIn("needs.precheck.outputs.migration_armed == 'true'", workflow)
        self.assertIn('[[ "$MIGRATION_ARMED" == \'true\' ]] || fail', workflow)
        self.assertIn("printf 'precheck_passed=true\\nmigration_armed=%s\\n'", workflow)

    def test_forbidden_write_workarounds_and_side_effects_are_absent(self) -> None:
        workflow = WORKFLOW.read_text(encoding="utf-8").lower()
        forbidden = (
            "apply_migration",
            "migration repair",
            "supabase db reset",
            "--include-all",
            "supabase db seed",
            "schema_migrations",
            "npm run import",
            "node src/importer",
            "node src/daily-catalog-growth",
            "select public.recover_catalog_daily_attempt(",
            "call public.recover_catalog_daily_attempt(",
        )
        for text in forbidden:
            self.assertNotIn(text, workflow)

    def test_shell_blocks_are_syntax_valid(self) -> None:
        parsed = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        scripts: list[str] = []
        for job in parsed["jobs"].values():
            for step in job.get("steps", []):
                if isinstance(step, dict) and isinstance(step.get("run"), str):
                    scripts.append(step["run"])
        self.assertGreaterEqual(len(scripts), 3)
        for script in scripts:
            result = subprocess.run(["bash", "-n"], input=script, text=True, capture_output=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_exact_one_pending_target_passes(self) -> None:
        remote = [version for version in LOCAL_VERSIONS if version != TARGET_VERSION]
        result = self.run_checker(LOCAL_VERSIONS, remote, "precheck")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "PRECHECK_VALID_ONE_PENDING")

    def test_second_pending_migration_fails_closed(self) -> None:
        local = LOCAL_VERSIONS + ["20990101000000"]
        remote = [version for version in LOCAL_VERSIONS if version != TARGET_VERSION]
        result = self.run_checker(local, remote, "precheck")
        self.assertNotEqual(result.returncode, 0)

    def test_unexpected_remote_only_fails_closed(self) -> None:
        remote = [version for version in LOCAL_VERSIONS if version != TARGET_VERSION] + ["20990101000000"]
        result = self.run_checker(LOCAL_VERSIONS, remote, "precheck")
        self.assertNotEqual(result.returncode, 0)

    def test_already_remote_target_fails_closed_before_write(self) -> None:
        result = self.run_checker(LOCAL_VERSIONS, LOCAL_VERSIONS, "precheck")
        self.assertNotEqual(result.returncode, 0)

    def test_postcheck_requires_complete_match(self) -> None:
        result = self.run_checker(LOCAL_VERSIONS, LOCAL_VERSIONS, "postcheck")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "POSTCHECK_VALID_EXACT_MATCH")
        result = self.run_checker(LOCAL_VERSIONS, [version for version in LOCAL_VERSIONS if version != TARGET_VERSION], "postcheck")
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
