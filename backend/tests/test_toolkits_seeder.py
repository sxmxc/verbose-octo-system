from pathlib import Path

import pytest

from app.toolkits import seeder


def test_discover_bundled_toolkits_uses_manifest_slug(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    repo_root = tmp_path / "repo"
    module_path = repo_root / "backend" / "app" / "toolkits" / "seeder.py"
    module_path.parent.mkdir(parents=True, exist_ok=True)
    module_path.write_text("# stub module path for testing\n")

    bundled_dir = repo_root / "toolkits" / "bundled" / "toolbox_health"
    bundled_dir.mkdir(parents=True, exist_ok=True)
    (bundled_dir / "toolkit.json").write_text('{"slug": "toolbox-health"}')

    monkeypatch.setattr(seeder, "__file__", str(module_path))

    mapping = seeder._discover_bundled_toolkits()

    assert "toolbox-health" in mapping
    assert mapping["toolbox-health"].resolve() == bundled_dir.resolve()
