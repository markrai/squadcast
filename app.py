import datetime
import json
import os
import re
import threading
import uuid
from collections import deque
from typing import Dict, List, Optional

from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
# Use threading mode on Windows for better compatibility
import sys
async_mode = 'threading' if sys.platform == 'win32' else None
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=async_mode)

DATA_DIR = os.environ.get("SQUADCAST_DATA_DIR", "data")
DEFAULT_ROOM = os.environ.get("SQUADCAST_DEFAULT_ROOM", "default")
MAX_MESSAGE_CHARS = int(os.environ.get("SQUADCAST_MAX_MESSAGE_CHARS", "4000"))

ROOM_RE = re.compile(r"^[a-zA-Z0-9_-]{1,32}$")
ROLE_RE = re.compile(r"^(elder|caregiver)$")

os.makedirs(DATA_DIR, exist_ok=True)

_presence_lock = threading.Lock()
_presence = {}  # room -> {"elder": set(sid), "caregiver": set(sid)}
_sid_to_room_role = {}  # sid -> (room, role)

_room_locks_lock = threading.Lock()
_room_locks = {}  # room -> Lock


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _safe_room(room: Optional[str]) -> str:
    room = (room or "").strip() or DEFAULT_ROOM
    if not ROOM_RE.match(room):
        return DEFAULT_ROOM
    return room


def _safe_role(role: Optional[str]) -> str:
    role = (role or "").strip().lower()
    if not ROLE_RE.match(role):
        return "caregiver"
    return role


def _chat_path(room: str) -> str:
    return os.path.join(DATA_DIR, f"chat_{room}.jsonl")


def _room_lock(room: str) -> threading.Lock:
    with _room_locks_lock:
        lock = _room_locks.get(room)
        if lock is None:
            lock = threading.Lock()
            _room_locks[room] = lock
        return lock


def _append_message(room: str, message: dict) -> None:
    path = _chat_path(room)
    line = json.dumps(message, ensure_ascii=False)
    with _room_lock(room):
        with open(path, "a", encoding="utf-8") as file:
            file.write(line + "\n")


def _load_messages(room: str, limit: int = 200) -> List[Dict]:
    path = _chat_path(room)
    if limit <= 0:
        return []
    try:
        with _room_lock(room):
            with open(path, "r", encoding="utf-8") as file:
                tail = deque(file, maxlen=limit)
    except FileNotFoundError:
        return []

    messages: List[Dict] = []
    for line in tail:
        line = line.strip()
        if not line:
            continue
        try:
            messages.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return messages


def _broadcast_presence(room: str) -> None:
    with _presence_lock:
        state = _presence.get(room) or {"elder": set(), "caregiver": set()}
        payload = {"room": room, "elder": len(state["elder"]), "caregiver": len(state["caregiver"])}
    socketio.emit("presence", payload, to=room)


@app.route("/")
def home():
    # Always use default room - no room concept in UI
    return render_template("home.html")


@app.route("/elder")
def elder():
    # Always use default room - no room concept in UI
    room = _safe_room(request.args.get("room"))  # Keep for backward compatibility
    return render_template("chat.html", room=room, role="elder", page_title="Chat (Elder)")


@app.route("/caregiver")
def caregiver():
    # Always use default room - no room concept in UI
    room = _safe_room(request.args.get("room"))  # Keep for backward compatibility
    return render_template("chat.html", room=room, role="caregiver", page_title="Chat (Caregiver)")


@app.route("/api/messages", methods=["GET"])
def api_messages():
    room = _safe_room(request.args.get("room"))
    try:
        limit = int(request.args.get("limit", "200"))
    except ValueError:
        limit = 200
    limit = max(1, min(limit, 500))
    return jsonify({"room": room, "messages": _load_messages(room, limit=limit)})


@app.route("/api/health", methods=["GET"])
def api_health():
    return jsonify({"ok": True})


@app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory("static", filename)


@app.route("/manifest.json")
def manifest():
    return send_from_directory("static", "manifest.json", mimetype="application/manifest+json")


@app.route("/service-worker.js")
def service_worker():
    return send_from_directory("static", "service-worker.js", mimetype="application/javascript")


@socketio.on("join")
def handle_join(data):
    room = _safe_room((data or {}).get("room"))
    role = _safe_role((data or {}).get("role"))

    join_room(room)

    with _presence_lock:
        state = _presence.setdefault(room, {"elder": set(), "caregiver": set()})
        state[role].add(request.sid)
        _sid_to_room_role[request.sid] = (room, role)

    emit("joined", {"room": room, "role": role}, to=request.sid)
    _broadcast_presence(room)


@socketio.on("send_message")
def handle_send_message(data):
    data = data or {}
    room = _safe_room(data.get("room"))
    role = _safe_role(data.get("role"))
    text = (data.get("text") or "").strip()

    if not text:
        return
    if len(text) > MAX_MESSAGE_CHARS:
        text = text[:MAX_MESSAGE_CHARS]

    message = {
        "id": uuid.uuid4().hex,
        "room": room,
        "role": role,
        "text": text,
        "ts": _now_iso(),
    }

    try:
        _append_message(room, message)
    except Exception as exc:
        emit("error", {"message": f"Failed to save message: {exc}"}, to=request.sid)
        return

    socketio.emit("new_message", message, to=room)


@socketio.on("ping")
def handle_ping():
    return


@socketio.on("disconnect")
def handle_disconnect():
    with _presence_lock:
        room_role = _sid_to_room_role.pop(request.sid, None)
        if not room_role:
            return
        room, role = room_role
        state = _presence.get(room)
        if not state:
            return
        state.get(role, set()).discard(request.sid)
    _broadcast_presence(room)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9090"))
    socketio.run(app, host="0.0.0.0", allow_unsafe_werkzeug=True, port=port, use_reloader=False)
