"""Flask application for the Föräldrapenningkalkylator."""

import os
from typing import Any, Dict, List

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


def berakna_daglig_ersattning(inkomst: int | None) -> int | None:
    """Calculate the daily parental benefit for a given monthly income."""

    if not inkomst:
        return None

    arsinkomst = inkomst * 12
    if arsinkomst < 117590:
        return 250
    if arsinkomst > 588000:
        return 1250

    sgi = arsinkomst * 0.97
    ersattning = sgi * 0.80 / 365
    return min(1250, max(250, round(ersattning)))


def _parse_value(raw: str) -> Any:
    """Convert a scalar string from the families file into Python data."""

    value = raw.strip()
    if not value:
        return ""
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]

    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False

    try:
        return int(value)
    except ValueError:
        try:
            return float(value)
        except ValueError:
            return value


def _parse_families_without_yaml(text: str) -> List[Dict[str, Any]]:
    """Fallback parser for the families file if PyYAML is unavailable."""

    families: List[Dict[str, Any]] = []
    current_family: Dict[str, Any] | None = None
    parents: List[Dict[str, Any]] = []
    current_parent: Dict[str, Any] | None = None
    current_section: str | None = None

    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith('#'):
            continue
        if stripped == "families":
            continue
        if stripped == "families:":
            current_section = None
            continue
        if stripped.startswith("- name:"):
            if current_family is not None:
                current_family['parents'] = parents
                families.append(current_family)
            current_family = {
                'name': _parse_value(stripped.split(':', 1)[1])
            }
            parents = []
            current_parent = None
            current_section = None
            continue
        if current_family is None:
            continue
        if stripped == "parents:":
            current_section = 'parents'
            current_parent = None
            continue
        if stripped == "custody:":
            current_section = 'custody'
            current_family['custody'] = {}
            current_parent = None
            continue
        if stripped == "barn:":
            current_section = 'barn'
            current_family['barn'] = {}
            current_parent = None
            continue
        if current_section == 'parents' and stripped.startswith('- role:'):
            current_parent = {'role': _parse_value(stripped.split(':', 1)[1])}
            parents.append(current_parent)
            continue
        if ':' not in stripped:
            continue
        key, value = stripped.split(':', 1)
        key = key.strip()
        parsed_value = _parse_value(value)
        if current_section == 'parents' and current_parent is not None:
            current_parent[key] = parsed_value
        elif current_section == 'custody':
            current_family.setdefault('custody', {})[key] = parsed_value
        elif current_section == 'barn':
            current_family.setdefault('barn', {})[key] = parsed_value
        else:
            current_family[key] = parsed_value

    if current_family is not None:
        current_family['parents'] = parents
        current_family.setdefault('custody', {})
        current_family.setdefault('barn', {})
        families.append(current_family)

    return families


def load_family_presets() -> List[Dict[str, Any]]:
    """Return the development family presets defined in the families file."""

    families_path = os.path.join(app.root_path, "families")
    if not os.path.exists(families_path):
        app.logger.warning("Family preset file missing: %s", families_path)
        return []

    try:
        with open(families_path, "r", encoding="utf-8") as handle:
            file_contents = handle.read()
    except OSError as exc:
        app.logger.error("Failed to read family presets: %s", exc)
        return []

    families: List[Dict[str, Any]] = []
    try:
        import yaml  # type: ignore
    except ImportError:
        yaml = None  # type: ignore

    if yaml is not None:
        try:
            data = yaml.safe_load(file_contents) or {}
            yaml_families = data.get("families")
            if isinstance(yaml_families, list):
                families = yaml_families
        except Exception as exc:  # noqa: BLE001
            app.logger.error("Failed to parse families with PyYAML: %s", exc)

    if not families:
        families = _parse_families_without_yaml(file_contents)

    if not isinstance(families, list):
        app.logger.warning("Family preset data missing 'families' list.")
        return []

    return families


@app.route("/", methods=["GET", "POST"])
def index():
    """Render the calculator and process submitted salary data."""

    print("Received request to /")

    daily_rate_1 = None
    daily_rate_2 = None
    monthly_fp_1 = None
    monthly_fp_2 = None

    if request.method == "POST":
        vardnad = request.form.get("vardnad")
        inkomst1 = request.form.get("inkomst1")
        inkomst2 = request.form.get("inkomst2")

        try:
            inkomst1 = int(inkomst1)
        except (TypeError, ValueError):
            app.logger.warning("Ogiltig inkomst1: %s", inkomst1)
            inkomst1 = 0
        try:
            inkomst2 = int(inkomst2)
        except (TypeError, ValueError):
            app.logger.warning("Ogiltig inkomst2: %s", inkomst2)
            inkomst2 = 0

        daily_rate_1 = berakna_daglig_ersattning(inkomst1)
        if vardnad == "gemensam":
            daily_rate_2 = berakna_daglig_ersattning(inkomst2)

        if daily_rate_1:
            monthly_fp_1 = round(daily_rate_1 * 4.3 * 7 / 100) * 100  # avrundat till 100-tal
        if daily_rate_2:
            monthly_fp_2 = round(daily_rate_2 * 4.3 * 7 / 100) * 100

    return render_template(
        "index.html",
        daily_rate_1=daily_rate_1,
        daily_rate_2=daily_rate_2,
        monthly_fp_1=monthly_fp_1,
        monthly_fp_2=monthly_fp_2,
    )


@app.route("/dev/families", methods=["GET"])
def dev_families():
    """Expose the configured family presets for development shortcuts."""

    return jsonify(load_family_presets())


if __name__ == "__main__":
    print("Starting Flask server...")
    app.run(debug=True)
