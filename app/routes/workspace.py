from pathlib import Path

from flask import Blueprint, abort, render_template

from ..models import Workspace

workspace_bp = Blueprint("workspace", __name__)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"


@workspace_bp.route("/d/<path_token>")
def workspace_page(path_token):
    ws = Workspace.query.filter_by(path_token=path_token).first()
    if not ws:
        abort(404)
    return render_template("workspace.html", workspace=ws)
