from .extensions import socketio

# Track connected workspace pages: path_token -> sid
_ws_connections: dict[str, str] = {}
_ws_skins: dict[str, str] = {}


@socketio.on("join", namespace="/ws")
def ws_join(data):
    """Divination page joins its workspace room."""
    from flask import request

    path_token = data.get("path_token")
    if not path_token:
        return
    sid = request.sid
    room = f"ws_{path_token}"
    socketio.server.enter_room(sid, room, namespace="/ws")
    _ws_connections[path_token] = sid

    # Notify manager that page is connected
    from .models import Workspace

    ws = Workspace.query.filter_by(path_token=path_token).first()
    if ws:
        socketio.emit("page_connected", {}, room=f"mgr_{ws.id}", namespace="/mgr")
    if path_token in _ws_skins:
        socketio.emit(
            "skin_update",
            {"skin": _ws_skins[path_token]},
            room=room,
            namespace="/ws",
        )


@socketio.on("join", namespace="/mgr")
def mgr_join(data):
    """Manager page joins its workspace room."""
    from flask import request

    workspace_id = data.get("workspace_id")
    if not workspace_id:
        return
    sid = request.sid
    room = f"mgr_{workspace_id}"
    socketio.server.enter_room(sid, room, namespace="/mgr")

    # Check if divination page is already connected and notify immediately
    from .models import Workspace

    ws = Workspace.query.get(workspace_id)
    if ws and ws.path_token in _ws_connections:
        socketio.emit("page_connected", {}, room=room, namespace="/mgr")


@socketio.on("disconnect", namespace="/ws")
def ws_disconnect():
    """Divination page disconnected."""
    from flask import request

    sid = request.sid
    # Find which path_token this sid was associated with
    disconnected_token = None
    for token, s in list(_ws_connections.items()):
        if s == sid:
            disconnected_token = token
            del _ws_connections[token]
            break

    if disconnected_token:
        from .models import Workspace

        ws = Workspace.query.filter_by(path_token=disconnected_token).first()
        if ws:
            socketio.emit(
                "page_disconnected", {}, room=f"mgr_{ws.id}", namespace="/mgr"
            )


# ── emit helpers (called from routes) ────────────────────────────────


def emit_divination_command(path_token: str, payload: dict):
    """Push a divination command to the workspace's divination page."""
    socketio.emit("divination_command", payload, room=f"ws_{path_token}", namespace="/ws")


def emit_alias_update(path_token: str, alias: str):
    """Push an alias update to the workspace's divination page."""
    socketio.emit("alias_update", {"alias": alias}, room=f"ws_{path_token}", namespace="/ws")


def emit_skin_update(path_token: str, skin: str):
    """Push a visual skin update to the workspace's divination page."""
    _ws_skins[path_token] = skin
    socketio.emit("skin_update", {"skin": skin}, room=f"ws_{path_token}", namespace="/ws")
