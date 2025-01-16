from flask import Flask, request, jsonify
import threading
from areaadmin.server.areaAdmin import run_app
import os
from flask import Flask, render_template, request, redirect, url_for, jsonify, session, send_file
import socket
import requests
import time

app = Flask(__name__, template_folder='../static/', static_folder='../static/')

instances = {}

def is_port_available(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) != 0

def set_default(name):
    remoteAreaURI = f"http://127.0.0.1:{instances[name]['port']}/api/area"
    print(f"Set default for {remoteAreaURI}")
    response = requests.post(f"{remoteAreaURI}", json={
        "name": f"{name}",
        "description": f"Country of {name}",
        "resources": {
            "social": {
                "amount": 50,
                "renew_rate": 0.002
            },
            "economic": {
                "amount": 250000000,
                "renew_rate": 0
            },
            "envEmissions": {
                "amount": 1000000,
                "renew_rate": -0.01
            },
            "human": {
                "amount": 67000000,
                "renew_rate": 0.01
            },
            "ground": {
                "amount": 643801,
                "renew_rate": 0.001
            },
            "ores": {
                "amount": 100000,
                "renew_rate": 0.001
            },
            "water": {
                "amount": 200000,
                "renew_rate": 0.01
            },
            "oil": {
                "amount": 0,
                "renew_rate": 0
            },
            "gas": {
                "amount": 0,
                "renew_rate": 0
            },
            "pm25": {
                "amount": 12,
                "renew_rate": -0.001
            }
        }
    })
    response.raise_for_status()

@app.route('/start', methods=['POST'])
def start_instance():
    data = request.get_json()
    name = data.get('name')
    port = int(data.get('port'))
    
    if name in instances:
        return jsonify({'error': 'Instance already running'}), 400

    if not is_port_available(port):
        return jsonify({'success': False, 'error': f'Port {port} is already in use.'}), 400

    thread = threading.Thread(target=run_app, args=(name, port), daemon=True)
    thread.start()

    instances[name] = {'thread': thread, 'port': port}
    status = f'Instance {name} started on port {port}'
    print(f'http://127.0.0.1:{port}/', status)

    try:
        print(f"Waiting the instance {name} to start ...")
        time.sleep(5)
        set_default(name)
    except Exception as e:
        return jsonify({'success': False, 'error': f'Failed to set defaults: {str(e)}'}), 500

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
    app.run(debug=True, port=5000, use_reloader=False)

if __name__ == '__main__':
    main()