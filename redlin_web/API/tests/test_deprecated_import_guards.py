import ast
from pathlib import Path


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
APP_DIRS = ("API", "CORE", "VIDEO")
SKIP_PATH_PARTS = {"tests", "migrations", "__pycache__"}
DEPRECATED_MODULES = {"API.task_2", "API.views", "VIDEO.transcript"}
DEPRECATED_FILES = {
    Path("API/task_2.py"),
}


def _iter_app_python_files():
    for app_dir in APP_DIRS:
        root = WORKSPACE_ROOT / app_dir
        for file_path in root.rglob("*.py"):
            rel_path = file_path.relative_to(WORKSPACE_ROOT)
            if rel_path in DEPRECATED_FILES:
                continue
            if any(part in SKIP_PATH_PARTS for part in rel_path.parts):
                continue
            yield file_path, rel_path


def _containing_package_parts(rel_path: Path) -> list[str]:
    # API/services/foo.py -> ["API", "services"]
    # API/__init__.py -> ["API"]
    return list(rel_path.with_suffix("").parts[:-1])


def _iter_imported_modules(node: ast.AST, rel_path: Path):
    if isinstance(node, ast.Import):
        for alias in node.names:
            yield alias.name, node.lineno
        return

    if not isinstance(node, ast.ImportFrom):
        return

    if node.level == 0:
        if node.module:
            yield node.module, node.lineno
        return

    package_parts = _containing_package_parts(rel_path)
    base_count = len(package_parts) - (node.level - 1)
    if base_count < 0:
        base_count = 0
    base_parts = package_parts[:base_count]

    if node.module:
        target = ".".join(base_parts + node.module.split("."))
    else:
        target = ".".join(base_parts)

    if target:
        yield target, node.lineno


def _is_deprecated_module(module_name: str) -> bool:
    return any(
        module_name == deprecated or module_name.startswith(f"{deprecated}.")
        for deprecated in DEPRECATED_MODULES
    )


def test_no_internal_imports_use_deprecated_compat_modules():
    violations: list[str] = []

    for file_path, rel_path in _iter_app_python_files():
        source = file_path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(rel_path))

        for node in ast.walk(tree):
            if not isinstance(node, (ast.Import, ast.ImportFrom)):
                continue

            for module_name, lineno in _iter_imported_modules(node, rel_path):
                if _is_deprecated_module(module_name):
                    violations.append(f"{rel_path}:{lineno} imports {module_name}")

    assert not violations, "Deprecated compatibility modules are still imported:\n" + "\n".join(
        sorted(violations)
    )
