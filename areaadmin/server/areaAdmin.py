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
import threading, time
import random
import sqlalchemy as DB

DEFAULT_DB_NAME = "area"
DEFAULT_PORT = 5000
DEFAULT_COUNTRY_NAME = "Template name"
DEFAULT_COUNTRY_DESCRIPTION = "Template description"
def jsonify(data):
    def replace_special_floats(obj):
        if isinstance(obj, float):
            if obj == float('inf'):
                return "Infinity"
            elif obj == float('-inf'):
                return "-Infinity"
            elif obj != obj: 
                return "NaN"
        return obj

    def recursive_replace(data):
        if isinstance(data, dict):
            return {k: recursive_replace(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [recursive_replace(item) for item in data]
        else:
            return replace_special_floats(data)

    processed_data = recursive_replace(data)
    return flask.jsonify(processed_data)

def create_app(db_name=DEFAULT_DB_NAME,name=DEFAULT_COUNTRY_NAME,description=DEFAULT_COUNTRY_DESCRIPTION):

    db_name_fname = f'{db_name}.db'
    app = Flask(__name__, template_folder='../static/', static_folder='../static/')
    app.secret_key = 'your_secret_key'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_name_fname
    db = SQLAlchemy(app)
    CORS(app)

    def debug_print(obj, indent=0):
        indent_str = '  ' * indent
        if isinstance(obj, dict):
            print(f"{indent_str}{{")
            for key, value in obj.items():
                print(f"{indent_str}  {key}: ", end="")
                debug_print(value, indent + 1)
            print(f"{indent_str}}}")
        elif isinstance(obj, list):
            print(f"{indent_str}[")
            for value in obj:
                debug_print(value, indent + 1)
            print(f"{indent_str}]")
        elif isinstance(obj, tuple):
            print(f"{indent_str}(")
            for value in obj:
                debug_print(value, indent + 1)
            print(f"{indent_str})")
        else:
            print(f"{indent_str}{repr(obj)}")

    def login_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated_function

    # For API not intented for users
    def auth_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # TODO
            return f(*args, **kwargs)
        return decorated_function

    class Composition(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        composed_process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), nullable=False)
        component_process_id = DB.Column(DB.Integer, nullable=False)
        amount = DB.Column(DB.Integer, nullable=False)

    class Tag(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        name = DB.Column(DB.String(50), unique=True)
        processes = db.relationship('ProcessTag', back_populates='tag')

    class Process(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        title = DB.Column(DB.String(100))  # Add title attribute
        composition = db.relationship('Composition', backref='process', lazy=True)
        tags = db.relationship('ProcessTag', back_populates='process')
        tags_names = association_proxy('tags', 'tag.name')
        metrics = DB.Column(DB.JSON)
        interactions = db.relationship('ProcessInteraction', back_populates='process', lazy=True)
        comments = db.relationship('ProcessComment', back_populates='process', lazy=True)
        usages = db.relationship('ProcessUsage', back_populates='process', cascade='delete')

        @staticmethod
        def get_usage(process):
            area = Area.query.first()
            if not area:
                return jsonify({'error': 'Area not found'}), 404
            process_usage = next((pu for pu in process.usages if pu.area_id == area.id), None)
            return process_usage.usage_count if process_usage else 0

    class ProcessInteraction(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), nullable=False)
        interaction_type = DB.Column(DB.String(10), nullable=False)
        user_id = DB.Column(DB.Integer, DB.ForeignKey('user.id'), nullable=False)
        process = db.relationship('Process', back_populates='interactions')
        user = db.relationship('User', backref='interactions')
        __table_args__ = (DB.UniqueConstraint('user_id', 'process_id', name='_user_process_uc'),)

    class ProcessComment(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        user_id = DB.Column(DB.Integer, DB.ForeignKey('user.id'), nullable=False)
        process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), nullable=False)
        comment = DB.Column(DB.Text, nullable=False)
        timestamp = DB.Column(DB.DateTime, default=datetime.utcnow)
        user = db.relationship('User', backref='comments')
        process = db.relationship('Process', back_populates='comments')

    class ProcessTag(db.Model):
        __tablename__ = 'process_tag'
        process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), primary_key=True)
        tag_id = DB.Column(DB.Integer, DB.ForeignKey('tag.id'), primary_key=True)
        process = db.relationship('Process', back_populates='tags')
        tag = db.relationship('Tag', back_populates='processes')

    class ProcessUsage(db.Model):
        area_id = DB.Column(DB.Integer, DB.ForeignKey('area.id'), primary_key=True)
        process_id = DB.Column(DB.Integer, DB.ForeignKey('process.id'), primary_key=True)
        usage_count = DB.Column(DB.Integer, default=0)

        area = db.relationship('Area', back_populates='process_usages')
        process = db.relationship('Process', back_populates='usages')

        def __repr__(self):
            return f"<ProcessUsage area_id={self.area_id} process_id={self.process_id} usage_count={self.usage_count}>"

    class User(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        username = DB.Column(DB.String(50), unique=True, nullable=False)
        password_hash = DB.Column(DB.String(128), nullable=False)

        def set_password(self, password):
            self.password_hash = generate_password_hash(password)

        def check_password(self, password):
            return check_password_hash(self.password_hash, password)

    class Trade(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        home_area_id = DB.Column(DB.Integer, DB.ForeignKey('area.id'), nullable=False)
        to_area_uri = DB.Column(DB.String(255), nullable=False)
        to_area_trade_id = DB.Column(DB.Integer, nullable=True)
        home_processes = DB.Column(DB.JSON)
        foreign_processes = DB.Column(DB.JSON)
        home_confirm = DB.Column(DB.Boolean, default=False)
        foreign_confirm = DB.Column(DB.Boolean, default=False)

        home_area = db.relationship('Area', foreign_keys=[home_area_id], back_populates='trades')

        def __repr__(self):
            return f"<Trade area_id={self.home_area_id} trade id={self.id}>"

    def tradeToJson(trade):
        return {
            'id': trade.id,
            'home_area_id': trade.home_area_id,
            'to_area_uri': trade.to_area_uri,
            'to_area_trade_id': trade.to_area_trade_id,
            'home_processes': trade.home_processes,
            'foreign_processes': trade.foreign_processes,
            'home_confirm': trade.home_confirm,
            'foreign_confirm': trade.foreign_confirm
        }

    def tradeSend(trade):
        tradeJSON = tradeToJson(trade)
        tradeJSON['uri'] = f'http://127.0.0.1:{app.config["SERVING_PORT"]}'
        response = requests.post(f"{trade.to_area_uri}/api/trade/receive", json=tradeJSON)
        return jsonify(response.json())

    def tradeRemoteDelete(trade):
        if trade.to_area_trade_id:
            response = requests.delete(f"{trade.to_area_uri}/api/trade/${trade.id}")
            if response.status_code == 404:
                return jsonify({'success': True, 'message': 'Remote seem already deleted'}), 200
            else:
                return jsonify(response.json())
        else:
            return jsonify({'success': True, 'message': 'No foreign trade to delete'}), 200
    
    @app.route('/api/trade/receive', methods=['POST'])
    @auth_required
    def trade_receive():
        area = Area.query.first()
        if not area:
            return jsonify({'error': 'Area not found'}), 404

        data = request.get_json()

        home_processes = data['foreign_processes']
        foreign_processes = data['home_processes']        
        data['foreign_confirm'] = data['home_confirm']

        to_area_trade_id = data['id']
        to_area_uri = data['uri']
        trade = Trade.query.filter_by(id=to_area_trade_id).first()

        if trade:
            trade.to_area_trade_id=to_area_trade_id
            trade.foreign_processes = foreign_processes
            trade.foreign_confirm = data['foreign_confirm']
            trade.home_processes = home_processes
        else:
            new_trade = Trade(
                home_area_id=area.id,
                to_area_uri=to_area_uri,
                home_processes=home_processes,
                foreign_processes=foreign_processes,
                to_area_trade_id=to_area_trade_id,
                foreign_confirm=data['foreign_confirm']
            )
            db.session.add(new_trade)
    
        try:
            db.session.commit()
            # TODO notify the client
            return jsonify({'success': True, 'message': 'Trade received and saved successfully'}), 201
        except Exception as e:
            db.session.rollback()
            print(str(e))
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/trade', methods=['POST'])
    @auth_required
    def initiate_trade():
        area = Area.query.first()
        if not area:
            return jsonify({'error': 'Home area not found'}), 404
        
        data = request.get_json()
        if 'to_area_uri' not in data:
            return jsonify({'success': False, 'error': 'Incomplete data provided'}), 400

        try:
            trade = Trade(
                home_area_id=area.id,
                to_area_uri=data['to_area_uri'],
                home_processes=data.get('home_processes', []),
                foreign_processes=data.get('foreign_processes', [])
            )
            db.session.add(trade)
            db.session.commit()
            tradeSend(trade)
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500
        return jsonify({'success': True, 'message': 'Trade setup successfully'}), 200

    @app.route('/api/trade/<int:trade_id>', methods=['POST','DELETE'])
    @auth_required
    def handle_trade(trade_id):
        trade = Trade.query.get(trade_id)
        if not trade:
            return jsonify({'error': 'Trade not found'}), 404
    
        if request.method == 'POST':
            data = request.get_json()
            try:
                if 'to_area_uri' in data:
                    trade.to_area_uri = data['to_area_uri']
                if 'home_processes' in data:
                    trade.home_processes = data['home_processes']
                if 'foreign_confirm' in data:
                    return jsonify({'success': False, 'error': 'This is reserved to the other side'}), 400
                if 'home_confirm' in data:
                    trade.home_confirm = data['home_confirm']

                db.session.commit()
                tradeSend(trade)
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'error': str(e)}), 500
                
            return jsonify({'success': True, 'message': 'Trade setup successfully'}), 200
        elif request.method == 'DELETE':
            try:
                tradeRemoteDelete(trade)
                db.session.delete(trade)
                db.session.commit()
                return jsonify({'success': True, 'message': 'Trade deleted successfully'}), 200
            except Exception as e:
                db.session.rollback()
                return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/trades', methods=['GET'])
    @auth_required
    def get_trades():
        area = Area.query.first()
        if not area:
            return jsonify({'error': 'Area not found'}), 404

        trades_data = [{
            'id': trade.id,
            'to_area_uri': trade.to_area_uri,
            'home_processes': trade.home_processes,
            'foreign_processes': trade.foreign_processes,
            'foreign_confirm': trade.foreign_confirm,
            'home_confirm': trade.home_confirm
        } for trade in area.trades]

        return jsonify(trades_data)
    
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

        @staticmethod
        def get_time_to_depletion(resource_amount, renew_rate, usage_balance):
            resource_renew_amount = resource_amount * renew_rate
            net_usage = resource_renew_amount + usage_balance

            if net_usage >= 0:
                if net_usage == 0 and resource_amount == 0:
                    return 0
                else:
                    return float('inf')
            else:
                return abs(resource_amount / net_usage) 

        @staticmethod
        def process_usage(area,process,state):
            process_usage = ProcessUsage.query.filter_by(area_id=area.id, process_id=process.id).first()
            if state:
                if not process_usage:
                    new_process_usage = ProcessUsage(area_id=area.id, process_id=process.id, usage_count=1)
                    db.session.add(new_process_usage)
            else:
                if process_usage:
                    db.session.delete(process_usage)
            return process_usage

        @staticmethod
        def metrics():
            area = Area.query.first()
            if not area:
                return jsonify({'error': 'Area not found'}), 404

            area_resources = area.resources
            processes = Process.query.all()
            trades = Trade.query.all()
            flow = {'input': {}, 'output': {}}
            
            for metric in Processes.metrics_get_ids_list():
                flow['input'][metric] = 0
                flow['output'][metric] = 0
            
            for usage in area.process_usages:
                process = usage.process
                for metric in Processes.metrics_get_ids_list():
                    for sens in ['input','output']:
                        flow[sens][metric] += Processes.retrieve_metric(processes, process, sens, metric) * usage.usage_count

            for trade in trades:
                for home_process in trade.home_processes:
                    for metric in Processes.metrics_get_ids_list():
                        if 'id' in home_process and 'amount' in home_process:
                            flow['output'][metric] -= Processes.retrieve_metric(processes, Processes.get_by_id(processes, home_process['id']), 'output', metric) * home_process['amount']
                
                response = requests.get(f"{trade.to_area_uri}/api/processes")
                response.raise_for_status()
                foreign_processes = response.json()
                for foreign_trade_process in trade.foreign_processes:
                    for metric in Processes.metrics_get_ids_list():
                        if 'id' in foreign_trade_process and 'amount' in foreign_trade_process:
                            flow['output'][metric] += Processes.retrieve_metric(foreign_processes, Processes.get_by_id(foreign_processes, foreign_trade_process['id']), 'output', metric) * foreign_trade_process['amount']
            
            resources_depletion = {}
            for metric in Processes.metrics_get_ids_list():
                usage_balance = flow['output'][metric] - flow['input'][metric]
                if area_resources.get(metric):
                    resources_depletion[metric] = Area.get_time_to_depletion(area_resources[metric]['amount'], area_resources[metric]['renew_rate'], usage_balance)
                else:
                    resources_depletion[metric] = float('inf') if usage_balance > 0 else 0

            return {
                'flow': flow,
                'resources_depletion': resources_depletion
            }
        
        @app.route('/api/area/metrics', methods=['GET'])
        @auth_required
        @staticmethod
        def get_flow():
            metrics = Area.metrics()
            return jsonify(metrics)

        @app.route('/api/area', methods=['POST','GET'])
        @auth_required
        @staticmethod
        def handle_area():
            if request.method == 'POST':
                data = request.json
                return jsonify(Area.set_area_data(data))
            elif request.method == 'GET':
                area = Area.query.first()

                if not area:
                    return jsonify({
                        'name': DEFAULT_COUNTRY_NAME,
                        'description': DEFAULT_COUNTRY_DESCRIPTION,
                        'resources': {}
                    })

                processes = [{
                    'id': pu.process_id,
                    'title': pu.process.title,
                    'usage_count': pu.usage_count
                } for pu in area.process_usages]

                return jsonify({
                    'name': area.name,
                    'description': area.description,
                    'resources': area.resources,
                    'processes': processes
                })

        @staticmethod
        def set_area_data(data):
            area_resources = data.get('resources', {})
            for key, resource in area_resources.items():
                if 'amount' not in resource or resource['amount'] is None:
                    resource['amount'] = 0
                if 'renew_rate' not in resource or resource['renew_rate'] is None:
                    resource['renew_rate'] = 0

            area_name = data.get('name', DEFAULT_COUNTRY_NAME)
            area_description = data.get('description', DEFAULT_COUNTRY_DESCRIPTION)

            area = Area.query.first()
            if not area:
                area = Area(name=area_name, description=area_description, resources=area_resources)
                db.session.add(area)
            else:
                area.name = area_name
                area.description = area_description
                area.resources = area_resources

            db.session.commit()
            return {'success': True}

    @app.route('/')
    def index():
        return render_template('index.html')

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
        db.session.commit()
        Area.set_area_data({})
        return redirect(url_for('logout'))

    @app.route('/api/process/<int:process_id>/like', methods=['POST'])
    @auth_required
    def like_process(process_id):
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'User not logged in'}), 403

        user_id = session['user_id']
        process = Process.query.get(process_id)
        if not process:
            return jsonify({'success': False, 'error': 'Process not found'}), 404

        interaction = ProcessInteraction.query.filter_by(user_id=user_id, process_id=process_id).first()

        if interaction:
            if interaction.interaction_type == 'dislike':
                interaction.interaction_type = 'like'
            else:
                return jsonify({'success': False, 'error': 'Already liked'}), 400
        else:
            new_interaction = ProcessInteraction(user_id=user_id, process_id=process_id, interaction_type='like')
            db.session.add(new_interaction)
        
        db.session.commit()
        return jsonify({'success': True})

    @app.route('/api/process/<int:process_id>/dislike', methods=['POST'])
    @auth_required
    def dislike_process(process_id):
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'User not logged in'}), 403

        user_id = session['user_id']
        process = Process.query.get(process_id)
        if not process:
            return jsonify({'success': False, 'error': 'Process not found'}), 404

        interaction = ProcessInteraction.query.filter_by(user_id=user_id, process_id=process_id).first()

        if interaction:
            if interaction.interaction_type == 'like':
                interaction.interaction_type = 'dislike'
            else:
                return jsonify({'success': False, 'error': 'Already disliked'}), 400
        else:
            new_interaction = ProcessInteraction(user_id=user_id, process_id=process_id, interaction_type='dislike')
            db.session.add(new_interaction)

        db.session.commit()
        return jsonify({'success': True})

    @app.route('/api/process/<int:process_id>/add_comment', methods=['POST'])
    @auth_required
    def comment_process(process_id):
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'User not logged in'}), 403

        user_id = session['user_id']
        process = Process.query.get(process_id)
        if not process:
            return jsonify({'success': False, 'error': 'Process not found'}), 404

        comment_text = request.json.get('comment')
        if not comment_text:
            return jsonify({'success': False, 'error': 'Comment is required'}), 400

        comment = ProcessComment(user_id=user_id, process_id=process_id, comment=comment_text)
        db.session.add(comment)
        db.session.commit()
        return jsonify({'success': True})
    
    @app.route('/api/select_process', methods=['POST'])
    @auth_required
    def select_process():
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

        area = Area.query.first()
        if not area:
            return jsonify({'error': 'Area not found'}), 404

        processes = Process.query.filter(Process.id.in_(ids)).all()
        if processes and len(processes) == len(states):
            for process, state in zip(processes, states):
                Area.process_usage(area,process,state)

            db.session.commit()

        return jsonify({'success': True})

    @app.route('/api/set_process', methods=['POST'])
    @auth_required
    def set_process():
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        if isinstance(data, dict):
            data = [data]

        response_processes = []
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
            amount = process_data.get('amount', 0)

            title = process_data.get('title', '')
            tags = process_data.get('tags', [])

            new_process = Process(id=id, title=title, metrics={
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

            area = Area.query.first()
            if not area:
                return jsonify({'error': 'Area not found'}), 404
            process_usage = Area.process_usage(area,new_process,selected)
            if process_usage:
                process_usage.amount = amount

            composition_data = process_data.get('composition', [])
            for item in composition_data:
                comp_id = item['id']
                comp_amount = item['amount']
                if comp_id and comp_amount:
                    new_composition = Composition(component_process_id=comp_id, composed_process_id=new_process.id, amount=comp_amount)
                    db.session.add(new_composition)
                else:
                    return jsonify({'error': 'Wrong missing keys in composition'}), 400
            response_processes.append(process_wrap_for_response(new_process))

        db.session.commit()
        return jsonify({'success': True, 'processes': response_processes})

    @app.route('/api/processes', methods=['GET'])
    @auth_required
    def get_processes():
        processes = Process.query.all()
        process_list = [process_wrap_for_response(process) for process in processes]
        return jsonify(process_list)

    @app.route('/api/process/<int:process_id>', methods=['GET','DELETE'])
    @auth_required
    def handle_process(process_id):
        process = Process.query.get(process_id)
        if not process:
            return jsonify({'error': 'Process not found'}), 404
        if request.method == 'GET':
            process_data = process_wrap_for_response(process)
            return jsonify(process_data)
        elif request.method == 'DELETE':
            Composition.query.filter_by(composed_process_id=process_id).delete()
            ProcessInteraction.query.filter_by(process_id=process.id).delete()
            ProcessComment.query.filter_by(process_id=process.id).delete()
            ProcessUsage.query.filter_by(process_id=process.id).delete()
            ProcessTag.query.filter_by(process_id=process.id).delete()
        
            db.session.delete(process)
            db.session.commit()
            return jsonify({'success': True}), 200

    @app.route('/api/update_composition/<int:process_id>', methods=['POST'])
    @auth_required
    def update_composition(process_id):
        data = request.json
        component_process_id = data.get('id')
        amount = data.get('amount')

        composition = Composition.query.filter_by(composed_process_id=process_id, component_process_id=component_process_id).first()
        if not composition:
            return jsonify({'error': 'Composition not found'}), 404

        composition.amount = amount
        db.session.commit()
        return jsonify({'success': True}), 200

    @app.route('/api/delete_composition/<int:process_id>/<int:component_process_id>', methods=['POST'])
    @auth_required
    def delete_composition(process_id, component_process_id):
        composition = Composition.query.filter_by(composed_process_id=process_id, component_process_id=component_process_id).first()
        if not composition:
            return jsonify({'error': 'Composition not found'}), 404

        db.session.delete(composition)
        db.session.commit()
        return jsonify({'success': True}), 200



    def guard_get_id():
        return Guard.get().id

    class GuardAlert(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        guard_id = DB.Column(DB.Integer, DB.ForeignKey('guard.id'), default=guard_get_id)
        title = DB.Column(DB.String)
        description = DB.Column(DB.String)
        time = DB.Column(DB.DateTime, default=datetime.now)
        area = DB.Column(DB.String)

    class Guard(db.Model):
        id = DB.Column(DB.Integer, primary_key=True)
        area_uris = DB.Column(DB.JSON, default=[])
        last_check_date = DB.Column(DB.DateTime, default=datetime.now)
        alerts = db.relationship('GuardAlert', backref='guard', lazy=True)

        @staticmethod
        def get():
            guard = Guard.query.first()
            if not guard:
                guard = Guard()
                db.session.add(guard)
                db.session.commit()
            return guard
        
        def checked_update(self):
            self.last_check_date = datetime.now()
            db.session.commit()

        @app.route('/api/guard/alerts/clear')
        @auth_required
        @staticmethod
        def guard_alert_delete():
            guard = Guard.get()
            GuardAlert.query.filter(GuardAlert.guard_id == guard.id).delete()
            db.session.commit()
            return {'success': True}
        
        @staticmethod
        @app.route('/api/guard/alert/<int:alert_id>', methods=['DELETE'])
        @auth_required
        def guard_alert_manage(alert_id):
            if request.method == 'DELETE':
                GuardAlert.query.filter(GuardAlert.id == alert_id).delete()
                db.session.commit()
                return {'success': True}

        @app.route('/api/guard/subscribe', methods=['POST'])
        @login_required
        @staticmethod
        def guard_subsribe():
            guard = Guard.get()
            uris = request.json.get('uri')
            
            if not uris:
                return jsonify({'error': 'Missing parameter "uri"'}), 400
            
            if not isinstance(uris,list):
                uris = [uris]

            oldURIs = guard.area_uris
            guard.area_uris = []
            guard.area_uris.extend(uris)
            guard.area_uris.extend(oldURIs)
            db.session.commit()
            return {'success': True}

        @app.route('/api/guard', methods=['GET'])
        @login_required
        @staticmethod
        def guard_list():
            guard = Guard.get()
            alerts = []
            for alert in guard.alerts:
                alerts.append({
                    'id': alert.id,
                    'title': alert.title,
                    'description': alert.description,
                    'area': alert.area,
                    'time': alert.time
                })
            return jsonify({
                'area_uris': guard.area_uris,
                'last_check_date': guard.last_check_date,
                'alerts': alerts
            })

        @app.route('/guard')
        @login_required
        @staticmethod
        def guard():
            return render_template('guard.html')
        
        @staticmethod
        def guard_daemon_loop():
            with app.app_context():
                while True:
                    guard = Guard.get()
                    countries = []
                    for uri in guard.area_uris:
                        response = requests.get(f"{uri}/api/area")
                        response.raise_for_status()
                        area = response.json()

                        response = requests.get(f"{uri}/api/processes")
                        response.raise_for_status()
                        processes = response.json()

                        response = requests.get(f"{uri}/api/area/metrics")
                        response.raise_for_status()
                        metrics = response.json()

                        countries.append({
                            'uri': uri,
                            'area': area,
                            'processes': processes,
                            'metrics': metrics
                        })

                    # Ici on devrait déjà identifier les processus similaires dans un premier temps
                    # exemple en comparant les input/ouput des process, + title desc
                    # pour l'instant on utilise des ids (qui ne sont potentiellement pas les mêmes)
                    processesOffers = {}
                    for area in countries:
                        for process_usage in area['area']['processes']:
                            id = process_usage['id']
                            processOffer = processesOffers.get(id, {
                                'uri': area['uri'], 'count': 0, 'id': id
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
                                area=f"{processOffer['uri']}",
                                description=f"De la part de {processOffer['uri']} sur {processOffer['id']}"
                            ))
                        else:
                            # Dans l'idéal estimer à quel point deux processus sont différents ou similaires
                            # En regardant la composition de ces derniers (input/output)
                            # Et on devrait regarder uniquement les processus impliqué dans des échanges (même indirecte)
                            process_id = processOffer['id']
                            price = -1
                            for area in countries:
                                for process in area['processes']:
                                    if process['id'] == process_id:
                                        sell_price = process['metrics']['input'].get('economic', 0) - process['metrics']['output'].get('economic', 0)
                                        if sell_price < price:
                                            db.session.add(GuardAlert( 
                                                title="Potentiel situation de vente à perte détectée",
                                                area=f"{processOffer['uri']}",
                                                description=f"sur {processOffer['id']} proposed price {sell_price} on previous {price}"
                                            ))

                        # Définit comme la valeur de sociale entre les bénéficiaires de tous les processus du pays cible (bénéficiaires de impors)
                        # versus la valeur sociale du pays d'échange (d'ou on importe)
                        if random.random() <= 0.1:
                            db.session.add(GuardAlert( 
                                title="Injustice social",
                                area=f"{processOffer['uri']}",
                                description=f"{processOffer['uri']} induit de la misère sociale via ses imports"
                            ))

                    for area in countries:
                        envEmissionsNet = area['metrics']['flow']['output']['envEmissions'] - area['metrics']['flow']['input']['envEmissions']
                        atmosphereFill = area['area']['resources'].get('envEmissions',{'amount': 0})['amount'] * (1 + area['area']['resources'].get('envEmissions',{'renew_rate': 0})['renew_rate']) - envEmissionsNet
                        if atmosphereFill < 0:
                            db.session.add(GuardAlert( 
                                title="Overpollution",
                                area=f"{processOffer['uri']}",
                                description=f"Pays eméttant plus de CO2 que ce que sa capacité d'absorption amount={abs(atmosphereFill)}"
                            ))

                    guard.checked_update()
                    db.session.commit()
                    time.sleep(30)

        @staticmethod
        def guard_daemon():
            thread = threading.Thread(target=Guard.guard_daemon_loop, daemon=True)
            thread.start()

    @app.route('/login', methods=['GET', 'POST'])
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

    @app.route('/dashboard', methods=['GET'])
    @login_required
    def dashboard():
        return render_template('dashboard.html')

    def process_wrap_for_response(process):
        """Helper function to format the process data for JSON response."""
        amount = Process.get_usage(process)
        selected = 0 < amount

        return {
            'id': process.id,
            'title': process.title,
            'selected': selected,
            'amount': amount,
            'metrics': process.metrics,
            'tags': [tag.tag.name for tag in process.tags],
            'composition': [{
                'id': comp.component_process_id,
                'amount': comp.amount
            } for comp in process.composition],
            'like_count': len([i for i in process.interactions if i.interaction_type == 'like']) -
                        len([i for i in process.interactions if i.interaction_type == 'dislike']),
            'comments': [{
                'user': comment.user.username,
                'date': comment.timestamp.isoformat(),
                'text': comment.comment
            } for comment in process.comments if comment.user]
        }

    @app.route('/logout')
    @login_required
    def logout():
        session.pop('user_id', None)
        return redirect(url_for('index'))

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

        @staticmethod
        def metrics_get_list():
            return [
                {'id': 'social', 'label': 'Social', 'icon': 'human.png', 'unit': ''},
                {'id': 'economic', 'label': 'Economic', 'icon': 'economic.png', 'unit': '$'},
                {'id': 'envEmissions', 'label': 'GES emissions in kgCO2eq', 'icon': 'carbon.png', 'unit': 'kgCO2eq'},
                {'id': 'human', 'label': 'Human', 'icon': 'human.png', 'unit': 'people'},
                {'id': 'ground', 'label': 'Ground', 'icon': 'land.png', 'unit': 'km2'},
                {'id': 'ores', 'label': 'Ores', 'icon': 'ore2.png', 'unit': 'tonnes'},
                {'id': 'water', 'label': 'Water', 'icon': 'water_drop.png', 'unit': 'L'},
                {'id': 'oil', 'label': 'Oil', 'icon': 'oil.png', 'unit': 'L'},
                {'id': 'gas', 'label': 'Gas', 'icon': 'gas.png', 'unit': 'L'},
                {'id': 'pm25', 'label': 'PM2.5', 'icon': 'smoke.png', 'unit': 'µg/m3'}
            ]

        @staticmethod
        def metrics_get_ids_list():
            return [metric['id'] for metric in Processes.metrics_get_list()]

    @app.route('/api/database', methods=['GET','POST'])
    @auth_required
    def handle_database():
        if request.method == 'GET':
            db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '../instance/' + db_name_fname)
            return send_file(db_path, as_attachment=True, download_name=db_name_fname)
        elif request.method == 'POST':
            file = request.files['file']
            if file:
                file_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '../instance/' + db_name_fname)
                file.save(file_path)
                db.create_all()
                return jsonify({'success': True})
            return jsonify({'success': False}), 400

    @app.route('/api/update_process_usage/<int:process_id>', methods=['POST'])
    @auth_required
    def update_process_usage(process_id):
        data = request.json
        new_usage_count = data.get('usage_count')

        if new_usage_count is None:
            return jsonify({'error': 'Missing usage count'}), 400

        area = Area.query.first()  # Assuming you're dealing with a single area scenario
        if not area:
            return jsonify({'error': 'Area not found'}), 404

        process_usage = ProcessUsage.query.filter_by(area_id=area.id, process_id=process_id).first()
        if not process_usage:
            # Assuming you want to create a new usage record if it doesn't exist
            process_usage = ProcessUsage(area_id=area.id, process_id=process_id, usage_count=new_usage_count)
            db.session.add(process_usage)
        else:
            process_usage.usage_count = new_usage_count

        db.session.commit()
        return jsonify({'success': True, 'id': process_id, 'new_usage_count': new_usage_count})

    with app.app_context():
        db.create_all()
        if not Area.query.first():
            Area.set_area_data({'name': name, 'description': description})
        Guard.guard_daemon()

    return app, db

def run_app(db_name=DEFAULT_DB_NAME,port=DEFAULT_PORT,name=DEFAULT_COUNTRY_NAME,description=DEFAULT_COUNTRY_DESCRIPTION,cli=False):
    app, db = create_app(db_name,name,description)
    app.config['SERVING_PORT'] = port
    app.run(host='127.0.0.1', port=port, debug=True,use_reloader=cli)

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
