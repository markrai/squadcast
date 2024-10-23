from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app)

# Set the file paths for each person's text
files = {
    1: 'person1.txt',
    2: 'person2.txt',
    3: 'person3.txt'
}

# Serve the index.html file dynamically using render_template
@app.route('/')
def serve_index():
    return render_template('index.html')

# Handle retrieving the messages on initial load
@app.route('/get_messages', methods=['GET'])
def get_messages():
    data = {'messages': {}, 'font_sizes': {}}
    for id, file_path in files.items():
        # Read message
        try:
            with open(file_path, 'r') as file:
                data['messages'][id] = file.read().strip()
        except FileNotFoundError:
            data['messages'][id] = ''

        # Read font size
        font_size_file = f'person{id}_fontsize.txt'
        try:
            with open(font_size_file, 'r') as file:
                data['font_sizes'][id] = float(file.read().strip())
        except (FileNotFoundError, ValueError):
            data['font_sizes'][id] = None  # Default font size will be applied
    return jsonify(data)

@socketio.on('save_font_size')
def handle_save_font_size(data):
    id = data['id']
    font_size = data['fontSize']

    print(f"Received font size for ID {id}: {font_size}")

    font_size_file = f'person{id}_fontsize.txt'
    try:
        with open(font_size_file, 'w') as file:
            file.write(str(font_size))
        emit('update_font_size', {'id': id, 'fontSize': font_size}, broadcast=True)
    except Exception as e:
        print(f"Failed to save font size: {e}")
        emit('error', {'message': f'Failed to save font size: {e}'}, broadcast=False)


# Serve static files like images, stylesheets, and scripts
@app.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)

# Handle saving the message via WebSocket
@socketio.on('save_message')
def handle_save_message(data):
    id = data['id']
    message = data['message']

    print(f"Received message for ID {id}: {message}")  # Log message on server

    if id in files:
        try:
            with open(files[id], 'w') as file:
                file.write(message)
            emit('update_message', {'id': id, 'message': message}, broadcast=True)
        except Exception as e:
            print(f"Failed to save message: {e}")  # Log error on server
            emit('error', {'message': f'Failed to save message: {e}'}, broadcast=False)
    else:
        print(f"Invalid person ID: {id}")  # Log invalid ID
        emit('error', {'message': 'Invalid person ID'}, broadcast=False)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', allow_unsafe_werkzeug=True, port=9090)
