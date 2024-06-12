from flask import Flask, render_template, request, redirect, url_for, jsonify, session, send_file
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import ast, copy, os, sys
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy
from functools import wraps
from datetime import datetime
import requests
from flask_cors import CORS

DEFAULT_DB_NAME = "country"
DEFAULT_PORT = 5000
DEFAULT_COUNTRY_NAME = None
DEFAULT_COUNTRY_DESCRIPTION = None

def create_app(db_name=DEFAULT_DB_NAME,name=DEFAULT_COUNTRY_NAME,description=DEFAULT_COUNTRY_DESCRIPTION):

    db_name_fname = f'{db_name}.db'
    app = Flask(__name__)
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
        id = db.Column(db.Integer, primary_key=True)
        composed_process_id = db.Column(db.Integer, db.ForeignKey('process.id'), nullable=False)
        component_process_id = db.Column(db.Integer, nullable=False)
        amount = db.Column(db.Integer, nullable=False)

    class Tag(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(50), unique=True)
        processes = db.relationship('ProcessTag', back_populates='tag')

    class Process(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        title = db.Column(db.String(100))  # Add title attribute
        composition = db.relationship('Composition', backref='process', lazy=True)
        tags = db.relationship('ProcessTag', back_populates='process')
        tags_names = association_proxy('tags', 'tag.name')
        metrics = db.Column(db.JSON)
        interactions = db.relationship('ProcessInteraction', back_populates='process', lazy=True)
        comments = db.relationship('ProcessComment', back_populates='process', lazy=True)
        usages = db.relationship('ProcessUsage', back_populates='process', cascade='delete')

        @staticmethod
        def get_usage(process):
            country = Country.query.first()
            if not country:
                return jsonify({'error': 'Country not found'}), 404
            process_usage = next((pu for pu in process.usages if pu.country_id == country.id), None)
            return process_usage.usage_count if process_usage else 0

    class ProcessInteraction(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        process_id = db.Column(db.Integer, db.ForeignKey('process.id'), nullable=False)
        interaction_type = db.Column(db.String(10), nullable=False)
        user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        process = db.relationship('Process', back_populates='interactions')
        user = db.relationship('User', backref='interactions')
        __table_args__ = (db.UniqueConstraint('user_id', 'process_id', name='_user_process_uc'),)

    class ProcessComment(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        process_id = db.Column(db.Integer, db.ForeignKey('process.id'), nullable=False)
        comment = db.Column(db.Text, nullable=False)
        timestamp = db.Column(db.DateTime, default=datetime.utcnow)
        user = db.relationship('User', backref='comments')
        process = db.relationship('Process', back_populates='comments')

    class ProcessTag(db.Model):
        __tablename__ = 'process_tag'
        process_id = db.Column(db.Integer, db.ForeignKey('process.id'), primary_key=True)
        tag_id = db.Column(db.Integer, db.ForeignKey('tag.id'), primary_key=True)
        process = db.relationship('Process', back_populates='tags')
        tag = db.relationship('Tag', back_populates='processes')

    class ProcessUsage(db.Model):
        country_id = db.Column(db.Integer, db.ForeignKey('country.id'), primary_key=True)
        process_id = db.Column(db.Integer, db.ForeignKey('process.id'), primary_key=True)
        usage_count = db.Column(db.Integer, default=0)

        country = db.relationship('Country', back_populates='process_usages')
        process = db.relationship('Process', back_populates='usages')

        def __repr__(self):
            return f"<ProcessUsage country_id={self.country_id} process_id={self.process_id} usage_count={self.usage_count}>"

    class User(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        username = db.Column(db.String(50), unique=True, nullable=False)
        password_hash = db.Column(db.String(128), nullable=False)

        def set_password(self, password):
            self.password_hash = generate_password_hash(password)

        def check_password(self, password):
            return check_password_hash(self.password_hash, password)

    class Trade(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        home_country_id = db.Column(db.Integer, db.ForeignKey('country.id'), nullable=False)
        to_country_uri = db.Column(db.String(255), nullable=False)
        to_country_trade_id = db.Column(db.Integer, nullable=True)
        home_processes = db.Column(db.JSON)
        foreign_processes = db.Column(db.JSON)
        home_confirm = db.Column(db.Boolean, default=False)
        foreign_confirm = db.Column(db.Boolean, default=False)

        home_country = db.relationship('Country', foreign_keys=[home_country_id], back_populates='trades')

        def __repr__(self):
            return f"<Trade country_id={self.home_country_id} trade id={self.id}>"

    def tradeToJson(trade):
        return {
            'id': trade.id,
            'home_country_id': trade.home_country_id,
            'to_country_uri': trade.to_country_uri,
            'to_country_trade_id': trade.to_country_trade_id,
            'home_processes': trade.home_processes,
            'foreign_processes': trade.foreign_processes,
            'home_confirm': trade.home_confirm,
            'foreign_confirm': trade.foreign_confirm
        }

    def tradeSend(trade):
        tradeJSON = tradeToJson(trade)
        tradeJSON['uri'] = f'http://127.0.0.1:{app.config["SERVING_PORT"]}'
        response = requests.post(f"{trade.to_country_uri}/api/trade/receive", json=tradeJSON)
        return jsonify(response.json())

    def tradeRemoteDelete(trade):
        if trade.to_country_trade_id:
            response = requests.delete(f"{trade.to_country_uri}/api/trade/${trade.id}")
            return jsonify(response.json())
        else:
            return jsonify({'success': True, 'message': 'No foreign trade to delete'}), 200
        
    @app.route('/api/trade/receive', methods=['POST'])
    @auth_required
    def trade_receive():
        country = Country.query.first()
        if not country:
            return jsonify({'error': 'Country not found'}), 404

        data = request.get_json()

        data['foreign_processes'] = data['home_processes']        
        data['foreign_confirm'] = data['home_confirm']

        to_country_trade_id = data['id']
        to_country_uri = data['uri']
        trade = Trade.query.filter_by(id=to_country_trade_id).first()

        if trade:
            trade.to_country_trade_id=to_country_trade_id
            trade.foreign_processes = data['foreign_processes']
            trade.foreign_confirm = data['foreign_confirm']
        else:
            new_trade = Trade(
                home_country_id=country.id,
                to_country_uri=to_country_uri,
                home_processes=[],
                foreign_processes=data['foreign_processes'],
                to_country_trade_id=to_country_trade_id,
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
        country = Country.query.first()
        if not country:
            return jsonify({'error': 'Home country not found'}), 404
        
        data = request.get_json()
        if not data or 'home_processes' not in data or 'to_country_uri' not in data:
            return jsonify({'success': False, 'error': 'Incomplete data provided'}), 400

        try:
            trade = Trade(
                home_country_id=country.id,
                to_country_uri=data['to_country_uri'],
                home_processes=data['home_processes'],
                foreign_processes=[]
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
                if 'to_country_uri' in data:
                    trade.to_country_uri = data['to_country_uri']
                if 'home_processes' in data:
                    trade.home_processes = data['home_processes']
                if 'foreign_processes' in data:
                    return jsonify({'success': False, 'error': 'This is reserved to the other side'}), 400
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
        country = Country.query.first()
        if not country:
            return jsonify({'error': 'Country not found'}), 404

        trades_data = [{
            'id': trade.id,
            'to_country_uri': trade.to_country_uri,
            'home_processes': trade.home_processes,
            'foreign_processes': trade.foreign_processes,
            'foreign_confirm': trade.foreign_confirm,
            'home_confirm': trade.home_confirm
        } for trade in country.trades]

        return jsonify(trades_data)
    
    class Country(db.Model):
        id = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(100))
        description = db.Column(db.String(100))
        resources = db.Column(db.JSON)
        process_usages = db.relationship('ProcessUsage', back_populates='country')
        trades = db.relationship('Trade', foreign_keys='Trade.home_country_id', back_populates='home_country')

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
        def metrics():
            country = Country.query.first()
            if not country:
                return jsonify({'error': 'Country not found'}), 404

            country_resources = country.resources
            processes = Process.query.all()
            trades = Trade.query.all()
            flow = {'input': {}, 'output': {}}
            
            for metric in Processes.metrics_get_ids_list():
                flow['input'][metric] = 0
                flow['output'][metric] = 0
            
            for usage in country.process_usages:
                process = usage.process
                for metric in Processes.metrics_get_ids_list():
                    for sens in ['input','output']:
                        flow[sens][metric] += Processes.retrieve_metric(processes, process, sens, metric) * usage.usage_count


            for trade in trades:
                for home_process in trade.home_processes:
                    for metric in Processes.metrics_get_ids_list():
                        flow['output'][metric] -= Processes.retrieve_metric(processes, Processes.get_by_id(processes, home_process['process_id']), 'output', metric) * home_process['amount']
                
                response = requests.get(f"{trade.to_country_uri}/api/processes")
                response.raise_for_status()
                foreign_processes = response.json()
                for foreign_trade_process in trade.foreign_processes:
                    for metric in Processes.metrics_get_ids_list():
                        flow['output'][metric] += Processes.retrieve_metric(foreign_processes, Processes.get_by_id(foreign_processes, foreign_trade_process['process_id']), 'output', metric) * foreign_trade_process['amount']
            
            resources_depletion = {}
            for metric in Processes.metrics_get_ids_list():
                usage_balance = flow['output'][metric] - flow['input'][metric]
                if country_resources.get(metric):
                    resources_depletion[metric] = Country.get_time_to_depletion(country_resources[metric]['amount'], country_resources[metric]['renew_rate'], usage_balance)
                else:
                    resources_depletion[metric] = float('inf') if usage_balance > 0 else 0

            return {
                'flow': flow,
                'resources_depletion': resources_depletion
            }

    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/api/reset_database', methods=['POST'])
    @login_required
    def reset_database():
        db.session.query(Tag).delete()
        db.session.query(User).delete()
        db.session.query(Composition).delete()
        db.session.query(Country).delete()
        db.session.query(Process).delete()
        db.session.query(ProcessTag).delete()
        db.session.query(ProcessUsage).delete()
        db.session.query(ProcessComment).delete()
        db.session.query(ProcessInteraction).delete()
        db.session.query(Trade).delete()
        db.session.commit()
        set_country_data({})
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

        country = Country.query.first()
        if not country:
            return jsonify({'error': 'Country not found'}), 404

        processes = Process.query.filter(Process.id.in_(ids)).all()
        if processes and len(processes) == len(states):
            for process, state in zip(processes, states):
                country_process_usage(country,process,state)

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

            country = Country.query.first()
            if not country:
                return jsonify({'error': 'Country not found'}), 404
            process_usage = country_process_usage(country,new_process,selected)
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

        db.session.commit()
        return jsonify({'success': True})
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
                # Create new user if not in database
                new_user = User(username=username)
                new_user.set_password(password)
                db.session.add(new_user)
                db.session.commit()
                session['user_id'] = new_user.id
                return redirect(url_for('dashboard'))
        return render_template('login.html')

    def country_process_usage(country,process,state):
        process_usage = ProcessUsage.query.filter_by(country_id=country.id, process_id=process.id).first()
        if state:
            if not process_usage:
                new_process_usage = ProcessUsage(country_id=country.id, process_id=process.id, usage_count=1)
                db.session.add(new_process_usage)
        else:
            if process_usage:
                db.session.delete(process_usage)
        return process_usage

    @app.route('/dashboard', methods=['GET'])
    @login_required
    def dashboard():
        processes = Process.query.all()
        return render_template('dashboard.html', processes=processes)

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
                metricValue = process.metrics[sens][metric]
            elif isinstance(process, dict):
                composition = process['composition']
                metricValue = process['metrics'][sens].get(metric, 0)

            for compo in composition:
                compo_process_id = 0
                compo_amount = 0
                if isinstance(compo, Composition):
                    compo_process_id = compo.component_process_id
                    compo_amount = compo.amount
                elif isinstance(compo, dict):
                    compo_process_id = compo['id']
                    compo_amount = compo['amount']

                compo_process = Processes.get_by_id(all_processes, compo_process_id)
                if compo_process:
                    total += Processes.retrieve_metric(all_processes, compo_process, sens, metric) * compo_amount
                else:
                    print(f"Process with id {compo_process_id} is not in the retrieved processes.")
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

    @app.route('/api/country/metrics', methods=['GET'])
    @login_required
    def get_flow():
        metrics = Country.metrics()
        return jsonify(metrics)

    @app.route('/api/country', methods=['POST','GET'])
    @auth_required
    def handle_country():
        if request.method == 'POST':
            data = request.json
            return jsonify(set_country_data(data))
        elif request.method == 'GET':
            country = Country.query.first()

            if not country:
                return jsonify({
                    'name': 'Default name',
                    'description': 'Default description',
                    'resources': {}
                })

            processes = [{
                'id': pu.process_id,
                'title': pu.process.title,
                'usage_count': pu.usage_count
            } for pu in country.process_usages]

            return jsonify({
                'name': country.name,
                'description': country.description,
                'resources': country.resources,
                'processes': processes
            })

    def set_country_data(data):
        country_resources = data.get('resources', {})
        for key, resource in country_resources.items():
            if 'amount' not in resource or resource['amount'] is None:
                resource['amount'] = 0
            if 'renew_rate' not in resource or resource['renew_rate'] is None:
                resource['renew_rate'] = 0

        country_name = data.get('name', 'Default Country')
        country_description = data.get('description', 'No description provided')

        country = Country.query.first()
        if not country:
            country = Country(name=country_name, description=country_description, resources=country_resources)
            db.session.add(country)
        else:
            country.name = country_name
            country.description = country_description
            country.resources = country_resources

        db.session.commit()
        return {'success': True}

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

        country = Country.query.first()  # Assuming you're dealing with a single country scenario
        if not country:
            return jsonify({'error': 'Country not found'}), 404

        process_usage = ProcessUsage.query.filter_by(country_id=country.id, process_id=process_id).first()
        if not process_usage:
            # Assuming you want to create a new usage record if it doesn't exist
            process_usage = ProcessUsage(country_id=country.id, process_id=process_id, usage_count=new_usage_count)
            db.session.add(process_usage)
        else:
            process_usage.usage_count = new_usage_count

        db.session.commit()
        return jsonify({'success': True, 'id': process_id, 'new_usage_count': new_usage_count})

    with app.app_context():
        db.create_all()
        if not Country.query.first():
            set_country_data({'name': name, 'description': description})

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
