from flask import Blueprint, render_template

manager_bp = Blueprint("manager", __name__)


@manager_bp.route("/manager")
def manager_page():
    return render_template("manager.html")
