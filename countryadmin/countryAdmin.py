from flask import Flask, render_template, request, redirect, url_for, jsonify, session, send_file
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import ast, copy, os
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy
from functools import wraps
from datetime import datetime

db_name_fname = 'country.db'
app = Flask(__name__)
app.secret_key = 'your_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_name_fname
db = SQLAlchemy(app)

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
    amount = db.Column(db.Integer)
    composition = db.relationship('Composition', backref='process', lazy=True)
    tags = db.relationship('ProcessTag', back_populates='process')
    tags_names = association_proxy('tags', 'tag.name')
    metrics = db.Column(db.JSON)
    interactions = db.relationship('ProcessInteraction', back_populates='process', lazy=True)
    comments = db.relationship('ProcessComment', back_populates='process', lazy=True)
    countries = db.relationship('ProcessUsage', back_populates='process', cascade='delete')

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
    process = db.relationship('Process', back_populates='countries')

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
    from_process_id = db.Column(db.Integer, db.ForeignKey('process.id'), nullable=False)
    to_process_id = db.Column(db.Integer, nullable=False)
    from_amount = db.Column(db.Integer, nullable=False)
    to_amount = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(50), default='pending')

    home_country = db.relationship('Country', foreign_keys=[home_country_id], back_populates='trades')
    from_process = relationship("Process", foreign_keys=[from_process_id])

    def __repr__(self):
        return f"<ProcessUsage country_id={self.home_country_id} trade id={self.id}>"

class Country(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    description = db.Column(db.String(100))
    resources = db.Column(db.JSON)
    process_usages = db.relationship('ProcessUsage', back_populates='country')
    trades = db.relationship('Trade', foreign_keys='Trade.home_country_id', back_populates='home_country')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/initiate_trade', methods=['POST'])
@login_required
def initiate_trade():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    country = Country.query.first()
    if not country:
        return jsonify({'error': 'Country not found'}), 404
    
    try:
        new_trade = Trade(
            home_country_id=country.id,
            from_process_id=data['from_process_id'],
            from_amount=data['from_amount'],
            to_country_uri=data['to_country_uri'],
            to_process_id=data['to_process_id'],
            to_amount=data['to_amount']
        )
        db.session.add(new_trade)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Trade initiated successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/get_trades', methods=['GET'])
@login_required
def get_trades():
    country = Country.query.first()
    if not country:
        return jsonify({'error': 'Country not found'}), 404

    trades_data = [{
        'id': trade.id,
        'to_country_uri': trade.to_country_uri,
        'from_process_id': trade.from_process_id,
        'to_process_id': trade.to_process_id,
        'from_amount': trade.from_amount,
        'to_amount': trade.to_amount,
        'status': trade.status
    } for trade in country.trades]

    return jsonify(trades_data)

@app.route('/reset_database', methods=['POST'])
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

@app.route('/like_process/<int:process_id>', methods=['POST'])
@login_required
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

@app.route('/dislike_process/<int:process_id>', methods=['POST'])
@login_required
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

@app.route('/add_comment/<int:process_id>', methods=['POST'])
@login_required
def add_comment(process_id):
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

@app.route('/select_process', methods=['POST'])
@login_required
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

    return redirect(url_for('dashboard'))

@app.route('/set_process', methods=['POST'])
@login_required
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

@app.route('/dashboard', methods=['GET'])
@login_required
def dashboard():
    processes = Process.query.all()
    return render_template('dashboard.html', processes=processes)

def process_wrap_for_response(process):
    """Helper function to format the process data for JSON response."""
    country = Country.query.first()
    if not country:
        return jsonify({'error': 'Country not found'}), 404
    process_usage = next((pu for pu in process.countries if pu.country_id == country.id), None)
    selected = 0 < process_usage.usage_count if process_usage else 0

    return {
        'id': process.id,
        'title': process.title,
        'selected': selected,
        'amount': process.amount,
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

@app.route('/get_processes', methods=['GET'])
@login_required
def get_processes():
    processes = Process.query.all()
    process_list = [process_wrap_for_response(process) for process in processes]
    return jsonify(process_list)

@app.route('/get_process/<int:process_id>', methods=['GET'])
@login_required
def get_process(process_id):
    process = Process.query.get(process_id)
    if not process:
        return jsonify({'error': 'Process not found'}), 404
    process_data = process_wrap_for_response(process)
    return jsonify(process_data)

@app.route('/delete_process/<int:id>', methods=['POST'])
@login_required
def delete_process(id):
    process = Process.query.get(id)
    if not process:
        return jsonify({'error': 'Process not found'}), 404

    # Supprimer les compositions associées
    Composition.query.filter_by(composed_process_id=id).delete()

    db.session.delete(process)
    db.session.commit()
    return jsonify({'success': True}), 200

@app.route('/update_composition/<int:process_id>', methods=['POST'])
@login_required
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

@app.route('/delete_composition/<int:process_id>/<int:component_process_id>', methods=['POST'])
@login_required
def delete_composition(process_id, component_process_id):
    composition = Composition.query.filter_by(composed_process_id=process_id, component_process_id=component_process_id).first()
    if not composition:
        return jsonify({'error': 'Composition not found'}), 404

    db.session.delete(composition)
    db.session.commit()
    return jsonify({'success': True}), 200

@app.route('/logout')
@login_required
def logout():
    session.pop('user_id', None)
    return redirect(url_for('index'))

@app.route('/set_country', methods=['POST'])
@login_required
def set_country_endpoint():
    data = request.json
    return jsonify(set_country_data(data))

def processMetricsGetList():
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

def set_country_data(data):
    country_resources = data.get('resources', {})
    for metric in processMetricsGetList():
        resource = country_resources.get(metric['id'], None)
        if resource is None:
            country_resources[metric['id']] = {'amount': 0, 'renew_rate': 0}
        else:
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

@app.route('/get_country', methods=['GET'])
@login_required
def get_country():
    country = Country.query.first()

    if not country:
        resources = {}
        for metric in processMetricsGetList():
            resources[metric] = {'amount': 0, 'renew_rate': 0}
        return jsonify({
            'name': 'Default name',
            'description': 'Default description',
            'resources': resources
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

@app.route('/export_database', methods=['GET'])
@login_required
def export_database():
    db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '../instance/' + db_name_fname)
    return send_file(db_path, as_attachment=True, download_name=db_name_fname)

@app.route('/import_database', methods=['POST'])
@login_required
def import_database():
    file = request.files['file']
    if file:
        file_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), '../instance/' + db_name_fname)
        file.save(file_path)
        db.create_all()
        return jsonify({'success': True})
    return jsonify({'success': False}), 400

@app.route('/update_process_usage/<int:process_id>', methods=['POST'])
@login_required
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

def main():
    port = 5000
    while True:
        try:
            app.run(debug=True, port=port)
            break
        except OSError:
            port += 1
        except Exception:
            break
        finally:
            port += 1
            continue

with app.app_context():
    db.create_all()
    if not Country.query.first():
        set_country_data({})

if __name__ == "__main__":
    main()
