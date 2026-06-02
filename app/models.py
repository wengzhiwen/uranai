from datetime import datetime, timezone

from .extensions import db


class Workspace(db.Model):
    __tablename__ = "workspaces"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    access_code = db.Column(db.Text, unique=True, nullable=False, index=True)
    path_token = db.Column(db.Text, unique=True, nullable=False, index=True)
    alias = db.Column(db.Text, default="", nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    records = db.relationship(
        "DivinationRecord", backref="workspace", lazy="dynamic"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "access_code": self.access_code,
            "path_token": self.path_token,
            "alias": self.alias,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DivinationRecord(db.Model):
    __tablename__ = "divination_records"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    workspace_id = db.Column(
        db.Integer, db.ForeignKey("workspaces.id"), nullable=False, index=True
    )
    mode = db.Column(db.Text, nullable=False)  # "name" | "zodiac"
    name_left = db.Column(db.Text, nullable=False)
    name_right = db.Column(db.Text, nullable=False)
    zodiac_left = db.Column(db.Text, nullable=True)
    zodiac_right = db.Column(db.Text, nullable=True)
    score = db.Column(db.Integer, nullable=False)
    miracle = db.Column(db.Text, nullable=True)  # "high" | "low" | null
    verdict = db.Column(db.Text, nullable=False)
    message = db.Column(db.Text, nullable=False)
    aspect = db.Column(db.Text, nullable=False)
    score_overridden = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        db.Index("ix_records_ws_created", "workspace_id", "created_at"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "mode": self.mode,
            "name_left": self.name_left,
            "name_right": self.name_right,
            "zodiac_left": self.zodiac_left,
            "zodiac_right": self.zodiac_right,
            "score": self.score,
            "miracle": self.miracle,
            "verdict": self.verdict,
            "message": self.message,
            "aspect": self.aspect,
            "score_overridden": self.score_overridden,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
