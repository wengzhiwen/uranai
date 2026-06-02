from flask import Blueprint, request, jsonify, session

from ..extensions import db
from ..models import Workspace, DivinationRecord

api_bp = Blueprint("api", __name__, url_prefix="/api")


# ── helpers ──────────────────────────────────────────────────────────

# Access code charset: digits 1-8 + lowercase letters excluding o,q
_ACCESS_CODE_CHARS = "12345678abcdefghijkmnprstuvwxyz"
_ACCESS_CODE_LEN = 8


def _generate_access_code():
    import secrets

    return "".join(secrets.choice(_ACCESS_CODE_CHARS) for _ in range(_ACCESS_CODE_LEN))


def _generate_path_token():
    import secrets

    return secrets.token_urlsafe(12)


def _get_workspace_id():
    """Return the authenticated workspace id from session, or None."""
    return session.get("workspace_id")


def _require_workspace():
    """Return the Workspace object or a (error_response, status) tuple."""
    ws_id = _get_workspace_id()
    if not ws_id:
        return None, (jsonify({"error": "unauthorized"}), 401)
    ws = db.session.get(Workspace, ws_id)
    if not ws:
        return None, (jsonify({"error": "workspace not found"}), 404)
    return ws, None


# ── workspace endpoints ──────────────────────────────────────────────


@api_bp.post("/workspace/create")
def workspace_create():
    """Create a new workspace and return the access code."""
    code = _generate_access_code()
    token = _generate_path_token()
    # Ensure uniqueness
    while Workspace.query.filter_by(access_code=code).first():
        code = _generate_access_code()
    while Workspace.query.filter_by(path_token=token).first():
        token = _generate_path_token()

    ws = Workspace(access_code=code, path_token=token, alias="")
    db.session.add(ws)
    db.session.commit()

    # Auto-login the creator
    session["workspace_id"] = ws.id

    return jsonify({"access_code": code, "workspace": ws.to_dict()})


@api_bp.post("/workspace/join")
def workspace_join():
    """Join an existing workspace by access code."""
    data = request.get_json(force=True)
    code = (data.get("access_code") or "").strip()
    if not code:
        return jsonify({"error": "access_code is required"}), 400

    ws = Workspace.query.filter_by(access_code=code).first()
    if not ws:
        return jsonify({"error": "invalid access code"}), 404

    session["workspace_id"] = ws.id
    return jsonify({"workspace": ws.to_dict()})


@api_bp.get("/workspace/info")
def workspace_info():
    ws, err = _require_workspace()
    if err:
        return err
    return jsonify({"workspace": ws.to_dict()})


@api_bp.put("/workspace/alias")
def workspace_alias():
    ws, err = _require_workspace()
    if err:
        return err
    data = request.get_json(force=True)
    alias = (data.get("alias") or "").strip()[:50]
    ws.alias = alias
    db.session.commit()

    # Notify connected divination pages
    from ..socket_events import emit_alias_update

    emit_alias_update(ws.path_token, alias)

    return jsonify({"workspace": ws.to_dict()})


# ── divination endpoints ─────────────────────────────────────────────


@api_bp.post("/divination/launch")
def divination_launch():
    ws, err = _require_workspace()
    if err:
        return err

    data = request.get_json(force=True)
    mode = data.get("mode", "name")
    name_left = (data.get("name_left") or "").strip()
    name_right = (data.get("name_right") or "").strip()
    zodiac_left = data.get("zodiac_left")
    zodiac_right = data.get("zodiac_right")
    score_override = data.get("score")  # optional int

    if not name_left or not name_right:
        return jsonify({"error": "name_left and name_right are required"}), 400

    if mode not in ("name", "zodiac"):
        return jsonify({"error": "mode must be 'name' or 'zodiac'"}), 400

    if mode == "zodiac" and (not zodiac_left or not zodiac_right):
        return jsonify({"error": "zodiac_left and zodiac_right required in zodiac mode"}), 400

    # Compute outcome
    if score_override is not None:
        # Score override: use Python port for verdict/message
        from ..divination import build_outcome_with_score

        outcome = build_outcome_with_score(
            score=int(score_override),
            mode=mode,
            name_left=name_left,
            name_right=name_right,
            zodiac_left=zodiac_left,
            zodiac_right=zodiac_right,
        )
    else:
        # Normal computation: let the client compute, but we still need
        # verdict/message for the record. Use Python port.
        from ..divination import build_outcome_normal

        outcome = build_outcome_normal(
            mode=mode,
            name_left=name_left,
            name_right=name_right,
            zodiac_left=zodiac_left,
            zodiac_right=zodiac_right,
        )

    # Save record
    record = DivinationRecord(
        workspace_id=ws.id,
        mode=mode,
        name_left=name_left,
        name_right=name_right,
        zodiac_left=zodiac_left if mode == "zodiac" else None,
        zodiac_right=zodiac_right if mode == "zodiac" else None,
        score=outcome["score"],
        miracle=outcome.get("miracle"),
        verdict=outcome["verdict"],
        message=outcome["message"],
        aspect=outcome["aspect"],
        score_overridden=score_override is not None,
    )
    db.session.add(record)
    db.session.commit()

    # Push to workspace divination page via WebSocket
    from ..socket_events import emit_divination_command

    emit_divination_command(
        ws.path_token,
        {
            "mode": mode,
            "nameL": name_left,
            "nameR": name_right,
            "zL": zodiac_left,
            "zR": zodiac_right,
            "score": outcome["score"],
            "miracle": outcome.get("miracle"),
            "verdict": outcome["verdict"],
            "message": outcome["message"],
            "aspect": outcome["aspect"],
        },
    )

    return jsonify({"record": record.to_dict()})


@api_bp.post("/divination/reset")
def divination_reset():
    ws, err = _require_workspace()
    if err:
        return err

    data = request.get_json(force=True)
    mode = data.get("mode", "name")
    if mode not in ("name", "zodiac"):
        mode = "name"

    from ..socket_events import emit_divination_command

    emit_divination_command(ws.path_token, {"action": "reset", "mode": mode})
    return jsonify({"ok": True})


@api_bp.get("/divination/recent")
def divination_recent():
    ws, err = _require_workspace()
    if err:
        return err
    records = (
        DivinationRecord.query.filter_by(workspace_id=ws.id)
        .order_by(DivinationRecord.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify({"records": [r.to_dict() for r in records]})


@api_bp.post("/divination/rerun/<int:record_id>")
def divination_rerun(record_id):
    ws, err = _require_workspace()
    if err:
        return err
    record = DivinationRecord.query.filter_by(
        id=record_id, workspace_id=ws.id
    ).first()
    if not record:
        return jsonify({"error": "record not found"}), 404

    # Push the same outcome again
    from ..socket_events import emit_divination_command

    emit_divination_command(
        ws.path_token,
        {
            "mode": record.mode,
            "nameL": record.name_left,
            "nameR": record.name_right,
            "zL": record.zodiac_left,
            "zR": record.zodiac_right,
            "score": record.score,
            "miracle": record.miracle,
            "verdict": record.verdict,
            "message": record.message,
            "aspect": record.aspect,
        },
    )

    # Create a new record (copy)
    new_record = DivinationRecord(
        workspace_id=ws.id,
        mode=record.mode,
        name_left=record.name_left,
        name_right=record.name_right,
        zodiac_left=record.zodiac_left,
        zodiac_right=record.zodiac_right,
        score=record.score,
        miracle=record.miracle,
        verdict=record.verdict,
        message=record.message,
        aspect=record.aspect,
        score_overridden=record.score_overridden,
    )
    db.session.add(new_record)
    db.session.commit()

    return jsonify({"record": new_record.to_dict()})
