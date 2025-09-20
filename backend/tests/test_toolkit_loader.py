import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.toolkit_loader import _LOADED_SLUGS, load_toolkit_workers


class LoadToolkitWorkersTests(unittest.TestCase):
    def setUp(self) -> None:
        _LOADED_SLUGS.clear()
        self.celery_app = object()
        self.toolkit = SimpleNamespace(
            slug="demo-toolkit",
            worker_module="demo.toolkit.worker",
            worker_register_attr=None,
        )

    def _run_loader_with_module(self, module):
        with patch("app.toolkit_loader._eligible_toolkits", return_value=[self.toolkit]), patch(
            "app.toolkit_loader.import_toolkit_module", return_value=module
        ):
            load_toolkit_workers(self.celery_app)

    def test_slug_marked_loaded_after_successful_register(self):
        calls = []

        def register(app, register_handler):
            calls.append((app, register_handler))

        module = SimpleNamespace(register=register)
        self._run_loader_with_module(module)

        self.assertIn(self.toolkit.slug, _LOADED_SLUGS)
        self.assertEqual(len(calls), 1)
        self.assertIs(calls[0][0], self.celery_app)

    def test_missing_register_does_not_mark_loaded(self):
        module = SimpleNamespace()
        self._run_loader_with_module(module)

        self.assertNotIn(self.toolkit.slug, _LOADED_SLUGS)

    def test_register_failure_does_not_mark_loaded(self):
        def register(app, register_handler):
            raise RuntimeError("boom")

        module = SimpleNamespace(register=register)
        self._run_loader_with_module(module)

        self.assertNotIn(self.toolkit.slug, _LOADED_SLUGS)


if __name__ == "__main__":
    unittest.main()
