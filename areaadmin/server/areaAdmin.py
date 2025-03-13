from flask import Flask, render_template, request, redirect, url_for, session, send_file
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import ast, copy, os, sys
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy
from functools import wraps
from datetime import datetime
import requests
from flask_cors import CORS
import flask, json
import threading, time, re
import random
import sqlalchemy as DB
from apiflask import APIFlask, HTTPTokenAuth
from areaadmin.server.custom.flask import jsonify
from areaadmin.server.custom.tools import *
from sqlalchemy.orm import backref

DEFAULT_DB_NAME = "area"
DEFAULT_PORT = 5000
DEFAULT_COUNTRY_NAME = "Template name"
DEFAULT_COUNTRY_DESCRIPTION = "Template description"
def IS_LOCAL_AREA_REGEX(uri):
    rex = re.compile(r'^\s*\d+\s*$')
    return rex.match(uri) is not None

def create_app(db_name=DEFAULT_DB_NAME,name=DEFAULT_COUNTRY_NAME,description=DEFAULT_COUNTRY_DESCRIPTION):

    db_name_fname = f'{db_name}.db'
    app = APIFlask(__name__, title="AreaAdmin API", version="1.0", template_folder='../static/', static_folder='../static/')
    app.url_map.strict_slashes = False
    app.secret_key = 'your_secret_key'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_name_fname
    app.security_schemes = {
        'BearerAuth': {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT'
        }
    }
    db = SQLAlchemy(app)
    CORS(app)

    def HOME_HOST_URI():
        return f'http://127.0.0.1:{app.config["SERVING_PORT"]}'

    def user_is_logged():
        return 'user_id' in session

    def login_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if user_is_logged():
                return f(*args, **kwargs)
            return redirect(url_for('login'))
        return decorated_function

    # For API not intented for users
    def auth_required(f):
        @wraps(f)
        @app.doc(security='BearerAuth')
        def decorated_function(*args, **kwargs):
            if not user_is_logged():

                auth_header = request.headers.get('Authorization')
                if not auth_header or not auth_header.startswith('Bearer '):
                    return jsonify({'message': 'Missing or invalid token'}), 401
                
                token = auth_header.split(' ')[1]
                if not validate_token(token):
                    return jsonify({'message': 'Invalid or expired token'}), 401
            
            return f(*args, **kwargs)
        return decorated_function

    def validate_token(token):
        return token == "admin"  # Replace with real validation logic
    
    def area_api_url(area):

        uri = area.get('uri')
        id = area.get('id')

        if uri is None:
            if id is None:               
                raise Exception("Both uri and id none")
            uri = HOME_HOST_URI()

        if id is None:
            id = 1
        
        if uri == "":
            uri = HOME_HOST_URI()

        return f"{uri}{'/' if not uri.endswith('/') and uri else ''}api/area/{id}/"

    class Composition(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        composed_process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), nullable=False)
        component_process_id = DB.Column(DB.Integer, nullable=False)
        amount = DB.Column(DB.Integer, nullable=False)

    class Tag(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        name = DB.Column(DB.String(50), unique=True)
        processes = db.relationship('ProcessTag', back_populates='tag')

    class Object(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        description = DB.Column(DB.String)
        descriptor = DB.Column(DB.JSON)
        tree_paths = DB.Column(DB.String) # TODO
        unit = db.Column(db.String, nullable=True)

    class ProcessMetric(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        process_id = db.Column(db.Integer, db.ForeignKey('process.id'), nullable=False)
        object_id = db.Column(db.Integer, db.ForeignKey('object.id'), nullable=False)
        io_type = db.Column(db.String(10), nullable=False)
        amount = db.Column(db.Integer, nullable=False)

        object = db.relationship('Object')

        def __init__(self, **kwargs):
            super().__init__(**kwargs)
            if self.io_type not in ['input', 'output']:
                raise ValueError("io_type must be 'input' or 'output'")

    class Process(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        title = DB.Column(DB.String, default="")
        description = DB.Column(DB.String, default="")
        composition = db.relationship('Composition', backref='process', lazy=True)
        tags = db.relationship('ProcessTag', back_populates='process')
        tags_names = association_proxy('tags', 'tag.name')
        metrics = db.relationship('ProcessMetric', backref='process', lazy=True)
        interactions = db.relationship('ProcessInteraction', back_populates='process', lazy=True)
        comments = db.relationship('ProcessComment', back_populates='process', lazy=True)
        usages = db.relationship('ProcessUsage', back_populates='process', cascade='delete')

        def get_usage(self, area=None):
            process_usage = next((pu for pu in self.usages if area == None or pu.area_id == area.id), None)
            process_usage = process_usage.amount if process_usage else 0
            if area is not None:
                for composition in area.compositions:
                    process_usage += self.get_usage(composition.child)
            return process_usage
        
        def get_like_count(self, area=None):
            count = 0
            if area is not None:
                for composition in area.compositions:
                    count += self.get_like_count(composition.child)
            count += len([i for i in self.interactions if (i.interaction_type == 'like' and (area == None or area.id == i.area_id))]) - len([i for i in self.interactions if (i.interaction_type == 'dislike' and (area == None or area.id == i.area_id))])
            return count
        
        def get_comments(self,area=None):
            comments = [{
                    'user': comment.user.username,
                    'date': comment.timestamp.isoformat(),
                    'text': comment.comment
                } for comment in self.comments if (comment.user and (area == None or area.id == comment.area_id))]
            if area is not None:
                for composition in area.compositions:
                    comments.extend(self.get_comments(composition.child))
            return comments
        
        def wrap_for_response(self, area=None):
            """Helper function to format the process data for JSON response."""
            amount = self.get_usage(area)
            selected = 0 < amount

            return {
                'id': self.id,
                'title': self.title,
                'description': self.description,
                'selected': selected,
                'amount': amount,
                'metrics': {
                    'input': [{
                        'id': metric.object_id, 
                        'amount': metric.amount,
                        'unit': metric.object.unit
                    } for metric in self.metrics if metric.io_type == 'input'],
                    'output': [{
                        'id': metric.object_id, 
                        'amount': metric.amount,
                        'unit': metric.object.unit
                    } for metric in self.metrics if metric.io_type == 'output'],                },
                'tags': [tag.tag.name for tag in self.tags],
                'composition': [{
                    'id': comp.component_process_id,
                    'amount': comp.amount
                } for comp in self.composition],
                'like_count': self.get_like_count(area),
                'comments': self.get_comments(area)
            }

        @app.route('/api/process/<int:id>', methods=['GET','DELETE'])
        @auth_required
        @staticmethod
        def handle(id):
            process = Process.query.get(id)
            if not process:
                return jsonify({'error': 'Process not found'}), 404
            if request.method == 'GET':
                process_data = process.wrap_for_response()
                return jsonify(process_data)
            elif request.method == 'DELETE':
                Composition.query.filter_by(composed_process_id=id).delete()
                Composition.query.filter_by(component_process_id=id).delete()
                ProcessInteraction.query.filter_by(process_id=id).delete()
                ProcessComment.query.filter_by(process_id=id).delete()
                ProcessUsage.query.filter_by(process_id=id).delete()
                ProcessTag.query.filter_by(process_id=id).delete()
                for trade in Trade.query.all():
                    oldProcesses = trade.home_processes
                    trade.home_processes = []
                    for index in range(len(oldProcesses)):
                        trade_process = oldProcesses[index]
                        if trade_process['id'] != id:
                            trade.home_processes.append(trade_process)
            
                db.session.delete(process)
                db.session.commit()
                return jsonify({'success': True}), 200

        @app.route('/api/process/<int:id>/composition', methods=['POST'])
        @auth_required
        @staticmethod
        def composition_add(id):
            data = request.json
            component_process_id = data.get('id')
            amount = data.get('amount')

            composition = Composition.query.filter_by(composed_process_id=id, component_process_id=component_process_id).first()
            if not composition:
                return jsonify({'error': 'Composition not found'}), 404

            composition.amount = amount
            db.session.commit()
            return jsonify({'success': True}), 200

        @app.route('/api/process/<int:id>/composition/<int:component_process_id>', methods=['DELETE'])
        @auth_required
        @staticmethod
        def composition_delete(id, component_process_id):
            composition = Composition.query.filter_by(composed_process_id=id, component_process_id=component_process_id).first()
            if not composition:
                return jsonify({'error': 'Composition not found'}), 404

            db.session.delete(composition)
            db.session.commit()
            return jsonify({'success': True}), 200


    class ProcessInteraction(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), nullable=False)
        interaction_type = DB.Column(DB.String(10), nullable=False)
        user_id = DB.Column(DB.Integer, DB.ForeignKey('user.id'), nullable=False)
        process = db.relationship('Process', back_populates='interactions')
        user = db.relationship('User', backref='interactions')
        __table_args__ = (DB.UniqueConstraint('user_id', 'process_id', name='_user_process_uc'),)

        area_id = DB.Column(DB.Integer, DB.ForeignKey('area.id'), nullable=False)
        area = db.relationship('Area')

    class ProcessComment(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        comment = DB.Column(DB.Text, nullable=False)
        timestamp = DB.Column(DB.DateTime, default=datetime.utcnow)

        user_id = DB.Column(DB.Integer, DB.ForeignKey('user.id'), nullable=False)
        user = db.relationship('User', foreign_keys='ProcessComment.user_id')

        process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), nullable=False)
        process = db.relationship('Process', foreign_keys='ProcessComment.process_id', back_populates='comments')
        
        area_id = DB.Column(DB.Integer, DB.ForeignKey('area.id'), nullable=False)
        area = db.relationship('Area', foreign_keys='ProcessComment.area_id')

    class ProcessTag(db.Model):
        __tablename__ = 'process_tag'
        process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), primary_key=True)
        tag_id = DB.Column(DB.Integer, DB.ForeignKey('tag.id'), primary_key=True)
        process = db.relationship('Process', back_populates='tags')
        tag = db.relationship('Tag', back_populates='processes')

    class ProcessUsage(db.Model):
        area_id = DB.Column(DB.Integer, DB.ForeignKey('area.id'), primary_key=True)
        process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), primary_key=True)
        amount = DB.Column(DB.Integer, default=0)

        area = db.relationship('Area', back_populates='process_usages')
        process = db.relationship('Process', back_populates='usages')

        def __repr__(self):
            return f"<ProcessUsage area_id={self.area_id} process_id={self.process_id} amount={self.amount}>"

    class User(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        username = DB.Column(DB.String(50), unique=True, nullable=False)
        password_hash = DB.Column(DB.String(128), nullable=False)

        def set_password(self, password):
            self.password_hash = generate_password_hash(password)

        def check_password(self, password):
            return check_password_hash(self.password_hash, password)
        
        @app.route('/api/user/<int:id>', methods=['GET'])
        @auth_required
        def get(id):
            user = User.query.filter_by(id=id).first()
            if user is None:
                return jsonify({'success': False, 'message': 'user not found'}), 404
            else:
                return jsonify({
                    'id': user.id,
                    'username': user.username
                }), 200

    class Trade(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        home_area_id = DB.Column(DB.Integer, DB.ForeignKey('area.id'), nullable=False)
        home_processes = DB.Column(DB.JSON)
        home_confirm = DB.Column(DB.Boolean, default=False)
        remote_host_uri = DB.Column(DB.String(255), nullable=True)
        remote_area_id = DB.Column(DB.Integer, nullable=True)
        remote_trade_id = DB.Column(DB.Integer, nullable=True)
        remote_processes = DB.Column(DB.JSON)
        remote_confirm = DB.Column(DB.Boolean, default=False)

        home_area = db.relationship('Area', foreign_keys=[home_area_id], back_populates='trades')

        def __repr__(self):
            return f"<Trade area_id={self.home_area_id} trade id={self.id}>"

        def toJson(self):
            return {
                'id': self.id,
                'home_area_id': self.home_area_id,
                'home_processes': self.home_processes,
                'home_confirm': self.home_confirm,
                'remote_host_uri': self.remote_host_uri,
                'remote_area_id': self.remote_area_id,
                'remote_trade_id': self.remote_trade_id,
                'remote_processes': self.remote_processes,
                'remote_confirm': self.remote_confirm
            }

        def get_remote_host_and_api(self):
            remote_host_uri = self.remote_host_uri if self.remote_host_uri else HOME_HOST_URI()
            return remote_host_uri, remote_host_uri + ("" if remote_host_uri.endswith("/") else "/") + "api/" + (f"area/{self.remote_area_id}/" if self.remote_area_id else "")

        def send(self):
            tradeJSON = self.toJson()
            remoteHostURI, remoteApiURI = self.get_remote_host_and_api()
            home_host_uri = HOME_HOST_URI()
            if remoteHostURI != home_host_uri:
                tradeJSON['home_host_uri'] = home_host_uri

            response = requests.post(f"{remoteApiURI}/trade/receive", json=tradeJSON)
            return jsonify(response.json())

        def remoteDelete(self):
            if self.remote_trade_id:
                remoteHostUri, remoteApiURI = self.get_remote_host_and_api()
                if self.remote_trade_id is not None:
                    response = requests.delete(f"{remoteApiURI}/trade/{self.remote_trade_id}")
                    if response.status_code == 404:
                        return jsonify({'success': True, 'message': 'Remote seem already deleted'}), 200
                    else:
                        return jsonify(response.json())
                else:
                    return jsonify({'success': True, 'message': 'Remote seem already deleted'}), 200
            else:
                return jsonify({'success': True, 'message': 'No foreign trade to delete'}), 200

    class AreaComposition(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        area_id = DB.Column(DB.Integer, DB.ForeignKey('area.id'), nullable=False)
        child_id = DB.Column(DB.Integer, DB.ForeignKey('area.id'), nullable=False)
        area = db.relationship('Area', foreign_keys='AreaComposition.area_id', back_populates='compositions')
        child = db.relationship('Area', foreign_keys='AreaComposition.child_id')
                               
    class Area(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        name = DB.Column(DB.String(100))
        description = DB.Column(DB.String(100))
        resources = DB.Column(DB.JSON)
        process_usages = db.relationship('ProcessUsage', back_populates='area')
        trades = db.relationship('Trade', foreign_keys='Trade.home_area_id', back_populates='home_area')
        compositions = db.relationship('AreaComposition', foreign_keys='AreaComposition.area_id', back_populates='area')
        
        guard_id = DB.Column(DB.Integer, DB.ForeignKey('guard.id'), nullable=False)
        guard = db.relationship('Guard')

        @staticmethod
        def set_area_data(data, rv={'area_id': 0}):
            area_resources = data.get('resources', {})
            for key, resource in area_resources.items():
                if 'amount' not in resource or resource['amount'] is None:
                    resource['amount'] = 0
                if 'renew_rate' not in resource or resource['renew_rate'] is None:
                    resource['renew_rate'] = 0

            id = data.get('id', None)

            area = None
            if id is None:
                guard = Guard()
                db.session.add(guard)
                db.session.commit()
                area = Area(name=data.get('name', DEFAULT_COUNTRY_NAME), description=data.get('description', DEFAULT_COUNTRY_DESCRIPTION), 
                            resources=area_resources, guard_id=guard.id
                )
                db.session.add(area)
            else:
                area = Area.query.get(id)
                if not area:
                    return jsonify({'error': 'Area not found'}), 404
                if data.get('name') is not None:
                    area.name = data.get('name')
                if data.get('description') is not None:
                    area.description = data.get('description')
                area.resources = area_resources

            compositions = data.get('compositions')
            if compositions is not None:
                AreaComposition.query.filter_by(area_id=id).delete()
                for composition in compositions:
                    if Area.query.get(composition.id) == None:
                        return jsonify({'error': f'Area {area.id} is composed of {composition.id} but this area not found'}), 404
                    compositionItem = AreaComposition(area_id=area.id,child_id=composition.id)
                    db.session.add(compositionItem)
            db.session.commit()
            rv['area_id'] = area.id
            return {'success': True}

        def get_time_to_depletion(self, metric, usage_balance):
            resource_amount = self.resources[metric]['amount']
            renew_rate = self.resources[metric]['renew_rate']
            resource_renew_amount = resource_amount * renew_rate
            net_usage = resource_renew_amount + usage_balance

            if net_usage >= 0:
                if net_usage == 0 and resource_amount == 0:
                    return 0
                else:
                    return float('inf')
            else:
                return abs(resource_amount / net_usage) 

        def process_set_usage(self,process,amount):
            process_usage = ProcessUsage.query.filter_by(area_id=self.id, process_id=process.id).first()
            if 0 < amount:
                if process_usage:
                    process_usage.amount = amount
                else:
                    new_process_usage = ProcessUsage(area_id=self.id, process_id=process.id, amount=amount)
                    db.session.add(new_process_usage)
            else:
                if process_usage:
                    db.session.delete(process_usage)
            return process_usage

        def fill_flow(self,flow):
            processes = Process.query.all()
            for usage in self.process_usages:
                process = usage.process
                for metric in Area.metrics_get_ids_list():
                    for sens in ['input','output']:
                        flow[sens][metric] += Processes.retrieve_metric(processes, process, sens, metric) * usage.amount
            
            for trade in self.trades:
                for home_trade_process in trade.home_processes:
                    for metric in Area.metrics_get_ids_list():
                        if 'id' in home_trade_process and 'amount' in home_trade_process:
                            flow['output'][metric] -= Processes.retrieve_metric(processes, Processes.get_by_id(processes, home_trade_process['id']), 'output', metric) * home_trade_process['amount']
                
                uri, apiURI = trade.get_remote_host_and_api()
                response = requests.get(f"{apiURI}/processes")
                response.raise_for_status()
                remote_processes = response.json()
                for foreign_trade_process in trade.remote_processes:
                    for metric in Area.metrics_get_ids_list():
                        if 'id' in foreign_trade_process and 'amount' in foreign_trade_process:
                            flow['output'][metric] += Processes.retrieve_metric(remote_processes, Processes.get_by_id(remote_processes, foreign_trade_process['id']), 'output', metric) * foreign_trade_process['amount']

            for composition in self.compositions:
                composition.child.fill_flow(flow)

        def metrics(self):
            flow = {'input': {}, 'output': {}}
            
            for metric in Area.metrics_get_ids_list():
                flow['input'][metric] = 0
                flow['output'][metric] = 0
            
            self.fill_flow(flow)
            
            resources_depletion = {}
            for metric in Area.metrics_get_ids_list():
                usage_balance = flow['output'][metric] - flow['input'][metric]
                if self.resources.get(metric):
                    resources_depletion[metric] = self.get_time_to_depletion(metric, usage_balance)
                else:
                    resources_depletion[metric] = float('inf') if usage_balance > 0 else 0

            return {
                'flow': flow,
                'resources_depletion': resources_depletion
            }
        
        def toJson(self, deep=False):
            
            processes = []
            if deep:
                processes = Process.query.all()
                processes = [process.wrap_for_response(self) for process in processes]
            else:
                processes = [{
                    'id': pu.process_id,
                    'title': pu.process.title,
                    'amount': pu.amount,
                } for pu in self.process_usages]

            compositions = [{'id': composition.child_id} for composition in self.compositions]

            return {
                'id': self.id,
                'uri': HOME_HOST_URI(),
                'name': self.name,
                'description': self.description,
                'resources': self.resources,
                'processes': processes,
                'compositions': compositions
            }

        @app.route('/api/area/<int:trash>/user/<int:id>', methods=['GET'])
        @auth_required
        @staticmethod
        def user_get(trash,id):
            return User.get(id)

        @app.route('/api/area/<int:id>/metrics', methods=['GET'])
        @auth_required
        @staticmethod
        def area_metrics(id):
            area = Area.query.get(id)
            if area:
                return jsonify(area.metrics())
            else:
                return jsonify({'error': 'Area not found'}), 404
        
        @app.route('/api/area/<int:id>/processes', methods=['GET'])
        @auth_required
        def area_get_processes(id):
            area = Area.query.get(id)
            if not area:
                return jsonify({'error': 'Area not found'}), 404
            processes = Process.query.all()
            process_list = [process.wrap_for_response(area) for process in processes]
            return jsonify(process_list)
        
        @app.route('/api/areas', methods=['GET'])
        @auth_required
        @staticmethod
        def get_areas():
            areas = Area.query.all()
            areas_response = []
            for area in areas:
                areas_response.append(area.toJson())
            return jsonify(areas_response)
        

        @app.route('/api/area/<int:id>', methods=['GET','POST','DELETE'])
        @auth_required
        @staticmethod
        def area_manage(id):
            area = Area.query.get(id)
            if not area:
                return jsonify({'error': 'Area not found'}), 404
            if request.method == 'POST':
                data = request.json
                if data.get('id') == None:
                    data['id'] = id
                return jsonify(Area.set_area_data(data))
            elif request.method == 'GET':
                return jsonify(area.toJson(request.args.get('deep', False)))
            elif request.method == 'DELETE':
                Area.query.get(id).delete()
                db.session.commit()
                return jsonify({'success': True})
            return jsonify({'success': False}), 500

        # Just to ensure compat between api of the main object and this one
        @app.route('/api/area/<int:id>/area', methods=['POST','GET','DELETE'])
        @auth_required
        @staticmethod
        def area_manage_clone(id):
            return Area.area_manage(id)

        @app.route('/api/area/<int:id>/trade/receive', methods=['POST'])
        @auth_required
        @staticmethod
        def trade_receive(id):
            try:
                data = request.get_json()

                trade_data = {
                    'home_trade_id': data['remote_trade_id'],
                    'home_area_id': id,
                    'home_processes': data['remote_processes'],

                    'remote_host_uri': data.get('home_host_uri'),
                    'remote_area_id': data['home_area_id'],
                    'remote_trade_id': data['id'],
                    'remote_processes': data['home_processes'],
                    'remote_confirm': data['home_confirm']
                }

                trade = Trade.query.filter_by(id=trade_data['home_trade_id']).first()

                if trade:
                    if trade_data.get('home_area_id') is not None:
                        trade.home_area_id     = trade_data['home_area_id']
                    if trade_data.get('home_processes') is not None:
                        trade.home_processes   = trade_data['home_processes']
                    if trade_data.get('remote_trade_id') is not None:
                        trade.remote_trade_id  = trade_data['remote_trade_id']
                    if trade_data.get('remote_processes') is not None:
                        trade.remote_processes = trade_data['remote_processes']
                    if trade_data.get('remote_confirm') is not None:
                        trade.remote_confirm   = trade_data['remote_confirm']
                    if trade_data.get('remote_area_id') is not None:
                        trade.remote_area_id   = trade_data['remote_area_id']
                    db.session.commit()
                else:
                    new_trade = Trade(
                        home_area_id=trade_data['home_area_id'],
                        home_processes=trade_data['home_processes'],
                        remote_host_uri=trade_data['remote_host_uri'],
                        remote_trade_id=trade_data['remote_trade_id'],
                        remote_area_id=trade_data['remote_area_id'],
                        remote_processes=trade_data['remote_processes'],
                        remote_confirm=trade_data['remote_confirm']
                    )
                    db.session.add(new_trade)
                    db.session.commit()
                    new_trade.send()

                # TODO notify the client
                return jsonify({'success': True, 'message': 'Trade received and saved successfully'}), 201
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)}), 500

        @app.route('/api/area/<int:trash>/trade/<int:trade_id>', methods=['POST','DELETE'])
        @auth_required
        @staticmethod
        def handle_trade(trash, trade_id):
            trade = Trade.query.get(trade_id)
            if not trade:
                return jsonify({'error': 'Trade not found'}), 404
            if request.method == 'DELETE':
                try:
                    db.session.delete(trade)
                    db.session.commit()
                    trade.remoteDelete()
                except Exception as e:
                    db.session.rollback()
                    return jsonify({'success': False, 'error': str(e)}), 500
                return jsonify({'success': True, 'message': 'Trade deleted successfully'}), 200
            elif request.method == 'POST':
                data = request.get_json()
                try:
                    if 'home_confirm' in data:
                        trade.home_confirm = data['home_confirm']
                    if 'home_processes' in data:
                        trade.home_processes = data['home_processes']
                    if 'remote_host_uri' in data:
                        trade.remote_host_uri = data['remote_host_uri']
                    if 'remote_area_id' in data:
                        trade.remote_area_id = data['remote_area_id']
                    if 'remote_confirm' in data:
                        return jsonify({'success': False, 'error': 'This is reserved to the other side'}), 400

                    db.session.commit()
                    trade.send()
                except Exception as e:
                    db.session.rollback()
                    return jsonify({'success': False, 'error': str(e)}), 500
                    
                return jsonify({'success': True, 'message': 'Trade setup successfully'}), 200
            
            return jsonify({'success': False}), 500

            
        @app.route('/api/area/<int:id>/trade', methods=['POST'])
        @auth_required
        @staticmethod
        def initiate_trade(id):
            data = request.get_json()
            if 'remote_host_uri' not in data and 'remote_area_id' not in data:
                return jsonify({'success': False, 'error': 'Incomplete data provided'}), 400

            try:
                trade = Trade(
                    home_area_id=id,
                    home_processes=data.get('home_processes', []),
                    remote_host_uri=data.get('remote_host_uri'),
                    remote_area_id=data.get('remote_area_id'),
                    remote_processes=data.get('remote_processes', [])
                )
                db.session.add(trade)
                db.session.commit()
                trade.send()
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'error': str(e)}), 500
            return jsonify({'success': True, 'message': 'Trade setup successfully'}), 200

        @app.route('/api/area/<int:id>/create_sub', methods=['POST'])
        @auth_required
        @staticmethod
        def create_sub(id):
            data = request.json
            rv = {}
            area = Area.query.get(id)
            if not area:
                return jsonify({'error': 'Area not found'}), 404
            
            Area.set_area_data(data, rv)

            composition = AreaComposition(area_id=id,child_id=rv['area_id'])
            db.session.add(composition)
            db.session.commit()
            return jsonify({'success': True})

        def get_trades_internal(self):
            trades_data = [trade.toJson() for trade in self.trades]

            for composition in self.compositions:
                trades_data.extend(composition.child.get_trades_internal())
            
            return trades_data

        @app.route('/api/area/<int:id>/trades', methods=['GET'])
        @auth_required
        @staticmethod
        def get_trades(id):
            area = Area.query.get(id)
            if not area:
                return jsonify({'error': 'Area not found'}), 404

            return jsonify(area.get_trades_internal())

        @app.route('/area/<int:id>/dashboard', methods=['GET'])
        @login_required
        @staticmethod
        def render_dashboard(id):
            return render_template('dashboard/dashboard.html', area_id=id)

        @app.route('/api/area/<int:trash>/processes/objects', methods=['GET'])
        @auth_required
        def endpoint_metrics_get_list(trash):
            return jsonify([{
                "id": object.id,
                "description": object.description,
                "descriptor": object.descriptor,
                "tree_paths": object.tree_paths,
                "unit": object.unit
            } for object in Object.query.all()])

        class Process():
            
            @app.route('/api/area/<int:trash>/process/<int:id>', methods=['GET','DELETE'])
            @auth_required
            @staticmethod
            def process_handle(trash,id):
                return Process.handle(id)

            @app.route('/api/area/<int:trash>/process/<int:id>/composition', methods=['POST'])
            @auth_required
            @staticmethod
            def process_composition_add(trash, id):
                return Process.composition_add(id)

            @app.route('/api/area/<int:trash>/process/<int:id>/composition/<int:component_process_id>', methods=['DELETE'])
            @auth_required
            @staticmethod
            def process_composition_delete(trash, id, component_process_id):
                return Process.composition_delete(id,component_process_id)
            
            @app.route('/api/area/<int:id>/update_process_usage/<int:process_id>', methods=['POST'])
            @auth_required
            @staticmethod
            def update_process_usage(id,process_id):
                data = request.json
                new_amount = data.get('amount')

                if new_amount is None:
                    return jsonify({'error': 'Missing usage count'}), 400

                process_usage = ProcessUsage.query.filter_by(area_id=id, process_id=process_id).first()
                if not process_usage:
                    process_usage = ProcessUsage(area_id=id, process_id=process_id, amount=new_amount)
                    db.session.add(process_usage)
                else:
                    process_usage.amount = new_amount

                db.session.commit()
                return jsonify({'success': True, 'id': process_id, 'new_amount': new_amount})

            @app.route('/api/area/<int:id>/process/<int:process_id>/like', methods=['POST'])
            @auth_required
            @staticmethod
            def like_process(id,process_id):
                if 'user_id' not in session:
                    return jsonify({'success': False, 'error': 'User not logged in'}), 403

                user_id = session['user_id']
                process = Process.query.get(process_id)
                if not process:
                    return jsonify({'success': False, 'error': 'Process not found'}), 404

                interaction = ProcessInteraction.query.filter_by(user_id=user_id, process_id=process_id, area_id=id).first()

                if interaction:
                    if interaction.interaction_type == 'dislike':
                        interaction.interaction_type = 'like'
                    else:
                        return jsonify({'success': False, 'error': 'Already liked'}), 400
                else:
                    new_interaction = ProcessInteraction(user_id=user_id, process_id=process_id, interaction_type='like',area_id=id)
                    db.session.add(new_interaction)
                
                db.session.commit()
                return jsonify({'success': True})

            @app.route('/api/area/<int:id>/process/<int:process_id>/dislike', methods=['POST'])
            @auth_required
            @staticmethod
            def dislike_process(id,process_id):
                if 'user_id' not in session:
                    return jsonify({'success': False, 'error': 'User not logged in'}), 403

                user_id = session['user_id']
                process = Process.query.get(process_id)
                if not process:
                    return jsonify({'success': False, 'error': 'Process not found'}), 404

                interaction = ProcessInteraction.query.filter_by(user_id=user_id, process_id=process_id, area_id=id).first()

                if interaction:
                    if interaction.interaction_type == 'like':
                        interaction.interaction_type = 'dislike'
                    else:
                        return jsonify({'success': False, 'error': 'Already disliked'}), 400
                else:
                    new_interaction = ProcessInteraction(user_id=user_id, area_id=id, process_id=process_id, interaction_type='dislike')
                    db.session.add(new_interaction)

                db.session.commit()
                return jsonify({'success': True})

            @app.route('/api/area/<int:id>/process/<int:process_id>/add_comment', methods=['POST'])
            @auth_required
            @staticmethod
            def comment_process(id,process_id):
                if 'user_id' not in session:
                    return jsonify({'success': False, 'error': 'User not logged in'}), 403

                user_id = session['user_id']
                process = Process.query.get(process_id)
                if not process:
                    return jsonify({'success': False, 'error': 'Process not found'}), 404

                comment_text = request.json.get('comment')
                if not comment_text:
                    return jsonify({'success': False, 'error': 'Comment is required'}), 400

                comment = ProcessComment(user_id=user_id, process_id=process_id, comment=comment_text, area_id=id)
                db.session.add(comment)
                db.session.commit()
                return jsonify({'success': True})
            
            @app.route('/api/area/<int:area_id>/set_process', methods=['POST'])
            @auth_required
            @staticmethod
            def set_process(area_id):
                data = request.json
                if not data:
                    return jsonify({'error': 'No data provided'}), 400
                
                area = Area.query.get(area_id)
                if not area:
                    return jsonify({'error': 'Area not found'}), 404

                if isinstance(data, dict):
                    data = [data]

                processes = []
                for process_data in data:
                    id = process_data.get('id')
                    if id is not None:
                        id = int(id)
                    
                    metrics = process_data.get('metrics', {})
                    if isinstance(metrics, dict):
                        input_metrics = metrics.get('input', {})
                        output_metrics = metrics.get('output', {})
                    else:
                        return jsonify({'error': 'Invalid metrics format'}), 400
                    
                    selected = process_data.get('selected', True)
                    if isinstance(selected, str):
                        selected = ast.literal_eval(selected.capitalize())

                    title = process_data.get('title', '')
                    description = process_data.get('description', '')
                    tags = process_data.get('tags', [])

                    new_process = Process(id=id, title=title, description=description, metrics={
                        "input": input_metrics,
                        "output": output_metrics
                    })

                    for tag_name in tags:
                        tag_name = tag_name.strip()
                        if tag_name:
                            tag = Tag.query.filter_by(name=tag_name).first()
                            if not tag:
                                tag = Tag(name=tag_name)
                                db.session.add(tag)
                            new_process.tags.append(tag)
                    
                    db.session.add(new_process)
                    db.session.commit()

                    if process_data.get('amount') is not None:
                        process_usage = area.process_set_usage(new_process,selected)
                        if process_usage:
                            process_usage.amount = process_data.get('amount')

                    composition_data = process_data.get('composition', [])
                    for item in composition_data:
                        comp_id = item['id']
                        comp_amount = item['amount']
                        if comp_id and comp_amount:
                            new_composition = Composition(component_process_id=comp_id, composed_process_id=new_process.id, amount=comp_amount)
                            db.session.add(new_composition)
                        else:
                            return jsonify({'error': 'Wrong missing keys in composition'}), 400
                        
                    processes.append(new_process.wrap_for_response(area))

                db.session.commit()
                return jsonify({'processes': processes})

            @app.route('/api/area/<int:id>/select_process', methods=['POST'])
            @auth_required
            @staticmethod
            def select_process(id):
                ids = []
                states = []
                id_single = request.form.get('id')
                if id_single:
                    ids.append(id_single)
                    states.append(request.form.get('selected'))
                else:
                    ids = request.form.getlist('id[]')
                    states = request.form.getlist('selected[]')
                states = [ast.literal_eval(value.capitalize()) for value in states]

                area = Area.query.get(id)
                if not area:
                    return jsonify({'error': 'Area not found'}), 404

                processes = Process.query.filter(Process.id.in_(ids)).all()
                if processes and len(processes) == len(states):
                    for process, state in zip(processes, states):
                        area.process_set_usage(process,state)

                db.session.commit()
                return jsonify({'success': True})

        class Guard():
            @app.route('/api/area/<int:id>/guard/alerts/clear')
            @auth_required
            @staticmethod
            def alerts_clear(id):
                area = Area.query.get(id)
                if not area:
                    return jsonify({'error': 'Area not found'}), 404
                guard = area.guard
                GuardAlert.query.filter(GuardAlert.guard_id == guard.id).delete()
                db.session.commit()
                return {'success': True}

            @app.route('/api/area/<int:id>/guard/alert/<int:alert_id>', methods=['DELETE'])
            @auth_required
            @staticmethod
            def alert(id,alert_id):
                if request.method == 'DELETE':
                    GuardAlert.query.filter_by(id=alert_id, guard_id=id).delete()
                    db.session.commit()
                    return {'success': True}

            @app.route('/api/area/<int:id>/guard/subscribe', methods=['POST'])
            @auth_required
            @staticmethod
            def subscribe(id):
                area = Area.query.get(id)
                if not area:
                    return jsonify({'error': 'Area not found'}), 404
                guard = area.guard
                uri = request.json.get('uri')
                id = request.json.get('id')
                
                if not uri and not id:
                    return jsonify({'error': 'Missing parameter'}), 400
                
                if not id:
                    id = 1

                db.session.add(GuardAreaWatch(area_id=id,area_uri=uri,guard_id=guard.id))
                db.session.commit()
                return {'success': True}

            @app.route('/api/area/<int:id>/guard', methods=['GET'])
            @login_required
            @staticmethod
            def list(id):
                area = Area.query.get(id)
                if not area:
                    return jsonify({'error': 'Area not found'}), 404
                guard = area.guard
                alerts = []
                for alert in guard.alerts:
                    alerts.append({
                        'id': alert.id,
                        'title': alert.title,
                        'description': alert.description,
                        'area': { 'uri': alert.area_uri, 'id': alert.area_id },
                        'time': alert.time
                    })
                return jsonify({
                    'watches': GuardAreaWatch.allToJson(guard.watches),
                    'last_check_date': guard.last_check_date,
                    'alerts': alerts
                })
        
            @app.route('/area/<int:id>/guard', methods=['GET'])
            @login_required
            @staticmethod
            def render_guard(id):
                return render_template('guard/guard.html', area_id=id)

        class Main():

            @staticmethod
            def ensurePresent(name,description):
                if not Area.Main.main_get():
                    Area.set_area_data({'name': name, 'description': description})

            @staticmethod
            def main_get():
                return Area.query.first()
            
            @app.route('/api/processes', methods=['GET'])
            @auth_required
            def get_processes():
                return Area.area_get_processes(Area.Main.main_get().id)
            
            @app.route('/api/area', methods=['POST','GET'])
            @auth_required
            @staticmethod
            def main_area_manage_clone():
                return Area.area_manage_clone(Area.Main.main_get().id)
            
            @app.route('/api/trade/receive', methods=['POST'])
            @auth_required
            @staticmethod
            def main_trade_receive():
                return Area.trade_receive(Area.Main.main_get().id)

            @app.route('/api/trade/<int:id>', methods=['POST','DELETE'])
            @auth_required
            @staticmethod
            def main_handle_trade(id):
                return Area.handle_trade(None,id)
            
            @app.route('/api/trade', methods=['POST'])
            @auth_required
            @staticmethod
            def main_initiate_trade():
                return Area.initiate_trade(Area.Main.main_get().id)

            @app.route('/api/metrics', methods=['GET'])
            @auth_required
            @staticmethod
            def main_metrics():
                area = Area.Main.main_get()
                if not area:
                    return jsonify({'error': 'Area not found'}), 404
                return Area.area_metrics(area.id)
            
            @app.route('/api/trades', methods=['GET'])
            @auth_required
            @staticmethod
            def main_get_trades():
                return Area.get_trades(Area.Main.main_get().id)
            
            @app.route('/dashboard', methods=['GET'])
            @login_required
            @staticmethod
            def dashboard():
                return Area.render_dashboard(Area.Main.main_get().id)
            
            @app.route('/api/processes/metrics', methods=['GET'])
            @auth_required
            def main_endpoint_metrics_get_list(): 
                return Area.endpoint_metrics_get_list(Area.Main.main_get().id)
            
            @app.route('/api/processes/metrics/ids', methods=['GET'])
            @auth_required
            def main_endpoint_metrics_get_ids_list(): 
                return Area.endpoint_metrics_get_ids_list(Area.Main.main_get().id)

            class Process():
                @app.route('/api/process/<int:id>/add_comment', methods=['POST'])
                @auth_required
                @staticmethod
                def main_comment_process(id):
                    return Area.Process.comment_process(Area.Main.main_get().id,id)
                
                @app.route('/api/process/<int:id>/dislike', methods=['POST'])
                @auth_required
                @staticmethod
                def main_dislike_process(id):
                    return Area.Process.dislike_process(Area.Main.main_get().id, id)
                
                @app.route('/api/process/<int:id>/like', methods=['POST'])
                @auth_required
                @staticmethod
                def main_like_process(id):
                    return Area.Process.like_process(Area.Main.main_get().id, id)
                
                @app.route('/api/update_process_usage/<int:id>', methods=['POST'])
                @auth_required
                @staticmethod
                def main_update_process_usage(id):
                    area = Area.Main.main_get() 
                    if not area:
                        return jsonify({'error': 'Area not found'}), 404
                    return Area.Process.update_process_usage(area.id,id)
                
                @app.route('/api/set_process', methods=['POST'])
                @auth_required
                @staticmethod
                def main_set_process():
                    return Area.Process.set_process(Area.Main.main_get().id)
                
                @app.route('/api/select_process', methods=['POST'])
                @auth_required
                @staticmethod
                def main_select_process():
                    return Area.Process.select_process(Area.Main.main_get().id)

            class Guard():
                @app.route('/api/guard/alerts/clear')
                @auth_required
                @staticmethod
                def main_alerts_clear():
                    return Area.Guard.alerts_clear(Area.Main.main_get().id)
                
                @app.route('/api/guard/alert/<int:alert_id>', methods=['DELETE'])
                @auth_required
                @staticmethod
                def main_alert(alert_id):
                    return Area.Guard.alert(Area.Main.main_get().id, alert_id)
                
                @app.route('/api/guard/subscribe', methods=['POST'])
                @login_required
                @staticmethod
                def main_subscribe():
                    return Area.Guard.subscribe(Area.Main.main_get().id)
                
                @app.route('/api/guard', methods=['GET'])
                @login_required
                @staticmethod
                def main_list():
                    return Area.Guard.list(Area.Main.main_get().id)
                
                @app.route('/guard', methods=['GET'])
                @login_required
                @staticmethod
                def guard():
                    return Area.Guard.render_guard(Area.Main.main_get().id)    

    @app.route('/')
    def index():
        return render_template('index.html')
    
    @app.route('/openapi')
    def openapi():
        return render_template('openapi.html')

    @app.route('/api/reset_database', methods=['POST'])
    @login_required
    def reset_database():
        db.session.query(Tag).delete()
        db.session.query(User).delete()
        db.session.query(Composition).delete()
        db.session.query(Area).delete()
        db.session.query(AreaComposition).delete()
        db.session.query(Process).delete()
        db.session.query(ProcessTag).delete()
        db.session.query(ProcessUsage).delete()
        db.session.query(ProcessComment).delete()
        db.session.query(ProcessInteraction).delete()
        db.session.query(Trade).delete()
        db.session.query(Guard).delete()
        db.session.query(GuardAlert).delete()
        db.session.query(GuardAreaWatch).delete()
        db.session.commit()
        Area.set_area_data({})
        return redirect(url_for('logout'))

    class GuardAlert(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        title = DB.Column(DB.String)
        description = DB.Column(DB.String)
        time = DB.Column(DB.DateTime, default=datetime.now)
        area_uri = DB.Column(DB.String)
        area_id = DB.Column(DB.Integer)

        guard_id = DB.Column(DB.Integer, DB.ForeignKey('guard.id'))
        guard = db.relationship('Guard', foreign_keys='GuardAlert.guard_id', back_populates='alerts')

    class GuardAreaWatch(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        area_id = DB.Column(DB.Integer, default=1)
        area_uri = DB.Column(DB.String, nullable=True)

        guard_id = DB.Column(DB.Integer, DB.ForeignKey('guard.id'))
        guard = db.relationship('Guard', foreign_keys='GuardAreaWatch.guard_id', back_populates='watches')

        @staticmethod
        def allToJson(watches):
            json = []
            for watch in watches:
                json.append(watch.toJson())
            return json
        
        def toJson(self):
            return {
                'id': self.area_id,
                'uri': self.area_uri
            }

    class Guard(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        last_check_date = DB.Column(DB.DateTime, default=datetime.now)
        alerts = db.relationship('GuardAlert', back_populates='guard', lazy=True)
        watches = db.relationship('GuardAreaWatch', back_populates='guard', lazy=True)

        def signal_a_pass(self):
            self.last_check_date = datetime.now()

        @staticmethod
        def get():
            return Area.Main.main_get().guard

        def daemon_loop(self_id):
            time.sleep(5)
            print("Guard background task started")
            with app.app_context():
                self = Guard.query.get(self_id)
                while True:
                    areas = []
                    for watch in self.watches:
                        apiURI = area_api_url({'uri': watch.area_uri, 'id': watch.area_id})
                        apiURI = apiURI.removesuffix('/')

                        response = requests.get(f"{apiURI}/area")
                        response.raise_for_status()
                        area = response.json()

                        response = requests.get(f"{apiURI}/processes")
                        response.raise_for_status()
                        processes = response.json()

                        response = requests.get(f"{apiURI}/metrics")
                        response.raise_for_status()
                        metrics = response.json()

                        areas.append({
                            'uri': watch.area_uri,
                            'id': watch.area_id,
                            'data': {
                                'area': area,
                                'processes': processes,
                                'metrics': metrics
                            }
                        })

                    # Ici on devrait déjà identifier les processus similaires dans un premier temps
                    # exemple en comparant les input/ouput des process, + title desc
                    # pour l'instant on utilise des ids (qui ne sont potentiellement pas les mêmes)
                    processesOffers = {}
                    for area in areas:
                        for process_usage in area['data']['area']['processes']:
                            id = process_usage['id']
                            processOffer = processesOffers.get(id, {
                                'area': {
                                    'id': area['id'],
                                    'uri': area['uri']
                                }, 'count': 0, 'id': id
                            })
                            processOffer['count'] += 1;
                            processesOffers[id] = processOffer
                    
                    for processOfferId in processesOffers:
                        processOffer = processesOffers[processOfferId]
                        if processOffer['count'] == 1:
                            # Une situation potentielle de monopole
                            # Si il n'y a pas d'échanges avec d'autres pays l'alerte ne devrait pas être utilisée
                            db.session.add(GuardAlert( 
                                title="Monopole detecté",
                                area_uri=f"{processOffer['area']['uri']}",
                                area_id=f"{processOffer['area']['id']}",
                                guard_id=self.id,
                                description=f"De la part de {processOffer['area']['uri']} sur {processOffer['id']}"
                            ))
                        else:
                            # Dans l'idéal estimer à quel point deux processus sont différents ou similaires
                            # En regardant la composition de ces derniers (input/output)
                            # Et on devrait regarder uniquement les processus impliqué dans des échanges (même indirecte)
                            process_id = processOffer['id']
                            price = -1
                            for area in areas:
                                for process in area['data']['processes']:
                                    if process['id'] == process_id:
                                        sell_price = process['metrics']['input'].get('economic', 0) - process['metrics']['output'].get('economic', 0)
                                        if sell_price < price:
                                            db.session.add(GuardAlert( 
                                                guard_id=self.id,
                                                title="Potentiel situation de vente à perte détectée",
                                                area_uri=f"{processOffer['area']['uri']}",
                                                area_id=f"{processOffer['area']['id']}",
                                                description=f"sur {processOffer['area']['id']} proposed price {sell_price} on previous {price}"
                                            ))

                        # Définit comme la valeur de sociale entre les bénéficiaires de tous les processus du pays cible (bénéficiaires de impors)
                        # versus la valeur sociale du pays d'échange (d'ou on importe)
                        if random.random() <= 0.1:
                            db.session.add(GuardAlert( 
                                title="Injustice social",
                                area_uri=f"{processOffer['area']['uri']}",
                                area_id=f"{processOffer['area']['id']}",
                                guard_id=self.id,
                                description=f"{processOffer['area']['uri']} induit de la misère sociale via ses imports"
                            ))

                    for area in areas:
                        envEmissionsNet = area['data']['metrics']['flow']['output']['envEmissions'] - area['data']['metrics']['flow']['input']['envEmissions']
                        atmosphereFill = area['data']['area']['resources'].get('envEmissions',{'amount': 0})['amount'] * (1 + area['data']['area']['resources'].get('envEmissions',{'renew_rate': 0})['renew_rate']) - envEmissionsNet
                        if atmosphereFill < 0:
                            db.session.add(GuardAlert( 
                                title="Overpollution",
                                area_uri=f"{processOffer['area']['uri']}",
                                area_id=f"{processOffer['area']['id']}",
                                guard_id=self.id,
                                description=f"Pays eméttant plus de CO2 que ce que sa capacité d'absorption amount={abs(atmosphereFill)}"
                            ))

                    self.signal_a_pass()
                    db.session.commit()
                    time.sleep(30)

        def daemon(self):
            thread = threading.Thread(target=Guard.daemon_loop, args=[self.id], daemon=True)
            thread.start()

    @app.route('/login', methods=['GET', 'POST'])
    @staticmethod
    def login():
        if request.method == 'POST':
            username = request.form['username']
            password = request.form['password']
            user = User.query.filter_by(username=username).first()
            if user:
                if user.check_password(password):
                    session['user_id'] = user.id
                    return redirect(url_for('dashboard'))
            else:
                new_user = User(username=username)
                new_user.set_password(password)
                db.session.add(new_user)
                db.session.commit()
                session['user_id'] = new_user.id
                return redirect(url_for('dashboard'))
        return render_template('login.html')

    @app.route('/logout')
    @login_required
    @staticmethod
    def logout():
        session.pop('user_id', None)
        return redirect(url_for('index'))

    @app.route('/user')
    @login_required
    @staticmethod
    def user():
        return render_template('user/user.html', user_id=session["user_id"])

    class Processes:
        @staticmethod
        def get_by_id(processes, process_id):
            return next(
                (process for process in processes if 
                    (isinstance(process, Process) and process.id == process_id) or
                    (isinstance(process, dict) and 'id' in process and process['id'] == process_id)
            ), None)

        @staticmethod
        def retrieve_metric(all_processes, process, sens, metric):
            total = 0
            composition = []
            metricValue = 0

            if isinstance(process, Process):
                composition = process.composition
                metricValue = process.metrics.get(sens, {}).get(metric, 0)
            elif isinstance(process, dict):
                composition = process.get('composition', [])
                metricValue = process.get('metrics', {}).get(sens, {}).get(metric, 0)
            
            for compo in composition:
                child_process_id = None
                compo_amount = 0

                if isinstance(compo, Composition):
                    child_process_id = compo.component_process_id
                    compo_amount = compo.amount
                elif isinstance(compo, dict):
                    child_process_id = compo.get('id')
                    compo_amount = compo.get('amount', 0)

                if child_process_id is not None:
                    compo_process = Processes.get_by_id(all_processes, child_process_id)
                    if compo_process:
                        total += Processes.retrieve_metric(all_processes, compo_process, sens, metric) * compo_amount
                    else:
                        print(f"Process with id {child_process_id} is not in the retrieved processes.")

            return total + metricValue

    @app.route('/api/database', methods=['GET','POST'])
    @auth_required
    def handle_database():
        if request.method == 'GET':
            db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '../../instance/' + db_name_fname)
            return send_file(db_path, as_attachment=True, download_name=db_name_fname)
        elif request.method == 'POST':
            file = request.files['file']
            if file:
                file_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '../../instance/' + db_name_fname)
                file.save(file_path)
                db.create_all()
                return jsonify({'success': True})
            return jsonify({'success': False}), 400
    
    def insert_primitive_types_if_not_in():
        if len(Object.query.all()) == 0:
            for object in [
                {'description': 'Social', 'unit': ''},
                {'description': 'Economic', 'unit': '$'},
                {'description': 'GES emissions in kgCO2eq', 'unit': 'kgCO2eq'},
                {'description': 'Human', 'unit': 'people'},
                {'description': 'Ground', 'unit': 'km2'},
                {'description': 'Ores', 'unit': 'tonnes'},
                {'description': 'Water', 'unit': 'L'},
                {'description': 'Oil', 'unit': 'L'},
                {'description': 'Gas', 'unit': 'L'},
                {'description': 'PM2.5', 'unit': 'µg/m3'}
            ]:
                object = Object(description=object["description"], unit=object['unit'])
                db.session.add(object)
            db.session.commit()

    with app.app_context():
        db.create_all()
        Area.Main.ensurePresent(name,description)
        for guard in Guard.query.all():
            guard.daemon()
        
        insert_primitive_types_if_not_in()

    return app, db

def run_app(db_name=DEFAULT_DB_NAME,port=DEFAULT_PORT,name=DEFAULT_COUNTRY_NAME,description=DEFAULT_COUNTRY_DESCRIPTION,cli=False):
    app, db = create_app(db_name,name,description)
    app.config['SERVING_PORT'] = port
    app.run(host='127.0.0.1', port=port, debug=True,use_reloader=cli)
    return app, db

def main(cli=False):
    db_name = DEFAULT_DB_NAME
    port = DEFAULT_PORT
    name = DEFAULT_COUNTRY_NAME
    description = DEFAULT_COUNTRY_DESCRIPTION
    
    if len(sys.argv) > 1:
        db_name = sys.argv[1]
    if len(sys.argv) > 2:
        port = int(sys.argv[2])
    if len(sys.argv) > 3:
        name = sys.argv[3]
    if len(sys.argv) > 4:
        description = sys.argv[4]
    run_app(db_name,port,name,description,cli)

if __name__ == "__main__":
    main(True)
