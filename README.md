![004-squadcast](https://github.com/user-attachments/assets/879b6e27-70b1-4e0b-a96b-94a848c30f4a)

# SquadCast: Two‑Person Chat
A simple, web-based 2-person chat app designed for an elderly-friendly “big text” view, with instantaneous bi-directional updates.

# Prerequisites:
- This app is hosted on NGINX (or similar) web-server.
- The server should also have Python 3.9+ and Flask installed.

OR

- `docker compose`

# Instructions:
## Run locally
1. Install deps: `pip install -r requirements.txt`
2. Run the app: `python app.py`
3. Open:
   - Elder device: `http://<server-ip>:9090/elder?room=default`
   - Caregiver device: `http://<server-ip>:9090/caregiver?room=default`

Use the same `room` value on both devices (e.g. `room=family1`).

## Run with Docker
`docker compose up -d`

# Recommendations:
- For a low-powered solution, we recommend a Raspberry Pi Zero, with Raspberry Pi OS installed.
- Midori, Chromium, or another browser with a full-screen mode would be suitable.
- Autostart example: `midori -e Fullscreen -a http://192.168.0.05:9090/elder?room=default`
- a touch-screen capable monitor would allow for users to increase and reduce font-sizes, and utilize future enhancements.

# Limitations:
- SquadCast is meant to be run on a home network; there is no authentication provided.
- Messages are stored on disk in `data/` (JSONL), one file per room.
