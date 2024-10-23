![image](https://github.com/user-attachments/assets/4022f1cd-185d-4c48-99d4-d3bc8f55b6a9)


# SquadCast
a family bulletin board system with instantaneous bi-directional updates, and a weather widget.

# Prerequisites:
- This app is hosted on NGINX (or similar) web-server.
- The server should also have Python 3.9+ and Flask installed.

# Instructions:
1. Fill in Weather API details in `static/script.js`
2. Update photos of family members also in the `static` directory. (person1.jpg, etc.)
3. Run the back-end Python/Flask application: `python app.py`
4. Start the NGINX server to serve the front-end.

# Recommendations:
- For a low-powered solution, we recommend a Raspberry Pi Zero, with Raspberry Pi OS installed.
- Midori, Chromium, or another browser with a full-screen mode would be suitable.
- Autostart example: `midori -e Fullscreen -a http://192.168.0.05:7777`
- a touch-screen capable monitor would allow for users to increase and reduce font-sizes, and utilize future enhancements.

# Limitations:
- Squadcast is meant to be run on a home network, therefore there is no authentication provided.
