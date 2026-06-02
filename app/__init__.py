from pathlib import Path

from flask import Flask, send_from_directory, jsonify

from .config import Config, BASE_DIR
from .extensions import db, socketio


def create_app():
    app = Flask(
        __name__,
        static_folder=str(BASE_DIR),
        static_url_path="",
        template_folder=str(Path(__file__).resolve().parent / "templates"),
    )
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode="gevent")

    # Ensure instance folder exists
    instance_dir = Path(app.config["SQLALCHEMY_DATABASE_URI"].split("///")[-1]).parent
    instance_dir.mkdir(parents=True, exist_ok=True)

    with app.app_context():
        db.create_all()

    # Register blueprints
    from .routes.manager import manager_bp
    from .routes.api import api_bp
    from .routes.workspace import workspace_bp

    app.register_blueprint(manager_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(workspace_bp)

    # Register Socket.IO events
    from . import socket_events  # noqa: F401

    @app.route("/")
    def index():
        return send_from_directory(str(BASE_DIR), "index.html")

    # Serve i18n JSON files
    @app.route("/i18n/<path:filename>")
    def i18n_file(filename):
        return send_from_directory(str(BASE_DIR / "i18n"), filename)

    return app
