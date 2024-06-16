from flask import Flask, request, jsonify
import threading
from areaadmin.server.areaAdmin import run_app
import os
from flask import Flask, render_template, request, redirect, url_for, jsonify, session, send_file
import socket

app = Flask(__name__, template_folder='../static/', static_folder='../static/')
@app.route('/api/processes', methods=['GET'])
def get_processes():
    return [
        {
            "amount": 0,
            "comments": [],
            "composition": [],
            "id": 1,
            "like_count": 0,
            "metrics": {
            "input": {
                "economic": 10,
                "envEmissions": 0,
                "gas": 0,
                "ground": 0,
                "human": 0,
                "oil": 0,
                "ores": 10,
                "pm25": 0,
                "social": 0,
                "water": 0
            },
            "output": {
                "economic": 0,
                "envEmissions": 50,
                "gas": 0,
                "ground": 0,
                "human": 0,
                "oil": 0,
                "ores": 0,
                "pm25": 0,
                "social": 0,
                "water": 0
            }
            },
            "selected": False,
            "tags": [],
            "title": "Faire une voiture thermique"
        },
    ]

if __name__ == '__main__':
    app.run(debug=True, port=6000, use_reloader=True)