from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/apply-supersede-migration.yml"
CHECKER = ROOT / "scripts/check-supersede-migration-history.py"
TARGET = "20261005230000"
TARGET_FILE = f"{TARGET}_supersede_failed_daily_catalog_job.sql"
LOCAL = sorted(p.name.split("_", 1)[0] for p in (ROOT / "supabase/migrations").glob("*.sql"))


def history(local: list[str], remote: list[str]) -> list[dict[str, str]]:
    remote_set = set(remote)
    return ([{"local": v, "remote": v, "time": "2026-10-05 00:00:00"} for v in local if v in remote_set]
            + [{"local": v, "remote": "", "time": ""} for v in local if v not in remote_set]
            + [{"local": "", "remote": v, "time": "2026-10-05 00:00:00"} for v in remote if v not in local])


class SupersedeMigrationWorkflowTests(unittest.TestCase):
    def run_checker(self, remote: list[str], phase: str):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); directory = root / "migrations"; directory.mkdir()
            for version in LOCAL:
                name = TARGET_FILE if version == TARGET else f"{version}_fixture.sql"
                (directory / name).write_text("-- fixture\n", encoding="utf-8")
            listing = root / "history.json"; listing.write_text(json.dumps({"migrations": history(LOCAL, remote)}), encoding="utf-8")
            return subprocess.run([sys.executable, str(CHECKER), "--phase", phase, "--migration-dir", str(directory), "--list-json", str(listing)], text=True, capture_output=True)

    def test_workflow_is_disarmed_and_exactly_scoped(self):
        text = WORKFLOW.read_text(encoding="utf-8").lower()
        self.assertIsInstance(yaml.safe_load(text), dict)
        self.assertIn("migration_armed: 'false'", text)
        self.assertIn("refs/heads/codex/supersede-failed-daily-20261005", text)
        self.assertIn(TARGET_FILE, text)
        self.assertIn("version: 2.119.0", text)
        self.assertIn("supabase migration list", text)
        self.assertIn("supabase db push", text)
        self.assertNotIn("--include-all", text)
        self.assertNotIn("apply_migration", text)
        self.assertNotIn("schema_migrations", text)

    def test_shell_blocks_parse(self):
        parsed = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
        scripts = [step["run"] for job in parsed["jobs"].values() for step in job.get("steps", []) if isinstance(step, dict) and isinstance(step.get("run"), str)]
        self.assertGreaterEqual(len(scripts), 2)
        for script in scripts:
            self.assertEqual(subprocess.run(["bash", "-n"], input=script, text=True, capture_output=True).returncode, 0)

    def test_exact_one_pending_and_postcheck(self):
        baseline = [v for v in LOCAL if v != TARGET]
        self.assertEqual(self.run_checker(baseline, "precheck").returncode, 0)
        self.assertEqual(self.run_checker(LOCAL, "postcheck").returncode, 0)
        self.assertNotEqual(self.run_checker(LOCAL, "precheck").returncode, 0)
        self.assertNotEqual(self.run_checker(baseline + ["20990101000000"], "precheck").returncode, 0)


if __name__ == "__main__":
    unittest.main()
