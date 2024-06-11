from flask import Flask, request, jsonify
import threading
from countryadmin.countryAdmin import run_app
import os
from flask import Flask, render_template, request, redirect, url_for, jsonify, session, send_file
import socket

app = Flask(__name__)

instances = {}

def start_flask_app(name, port):
    run_app(name,port)

def is_port_available(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) != 0

@app.route('/start', methods=['POST'])
def start_instance():
    data = request.get_json()
    name = data.get('name')
    port = int(data.get('port'))
    if name in instances:
        return jsonify({'error': 'Instance already running'}), 400

    if not is_port_available(port):
        return jsonify({'success': False, 'error': f'Port {port} is already in use.'}), 400

    # Run a new Flask app in a separate thread
    thread = threading.Thread(target=start_flask_app, args=(name, port), daemon=True)
    thread.start()
    instances[name] = {'thread': thread, 'port': port}
    status = f'Instance {name} started on port {port}'
    print(f'http://127.0.0.1:{port}/', status)
    return jsonify({'message': status}), 200

@app.route('/shutdown', methods=['POST'])
def shutdown_instance():
    data = request.get_json()
    name = data.get('name')
    if name not in instances:
        return jsonify({'error': 'Instance not found'}), 404
    # Flask does not support programmatically stopping easily; this requires additional handling
    # For example, you could modify Flask apps to listen for a shutdown signal or check a condition
    # Currently, Flask can be stopped by terminating the process or forcibly stopping the thread
    return jsonify({'error': 'Flask shutdown via threading is not straightforward and not implemented here'}), 400

@app.route('/list', methods=['GET'])
def list_instances():
    instance_details = [
        {'name': key, 'url': f"http://127.0.0.1:{value['port']}", 'port': value['port']}
        for key, value in instances.items()
    ]
    return jsonify(instance_details), 200

@app.route('/')
def index():
    return render_template('manager.html')

def main():
    app.run(debug=True, port=5000)

if __name__ == '__main__':
    main()