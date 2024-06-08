from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import ast, copy
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy
from functools import wraps

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'your_secret_key'

# Configure SQLAlchemy for database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///processes.db'
db = SQLAlchemy(app)

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

class ProcessTag(db.Model):
    __tablename__ = 'process_tag'
    process_id = db.Column(db.Integer, db.ForeignKey('process.id'), primary_key=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tag.id'), primary_key=True)

class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)

class Process(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))  # Add title attribute
    selected = db.Column(db.Boolean, default=False)
    amount = db.Column(db.Integer)
    composition = db.relationship('Composition', backref='process', lazy=True)
    tags = relationship('Tag', secondary='process_tag', backref='processes')
    tag_names = association_proxy('tags', 'name')
    metrics = db.Column(db.JSON)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Country(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    resources = db.Column(db.JSON)

# Ensure database tables are created
with app.app_context():
    db.create_all()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/reset_database', methods=['POST'])
@login_required
def reset_database():
    db.session.query(Tag).delete()
    db.session.query(ProcessTag).delete()
    db.session.query(User).delete()
    db.session.query(Process).delete()
    db.session.query(Composition).delete()
    db.session.query(Country).delete()
    db.session.commit()
    return redirect(url_for('dashboard'))

@app.route('/update_process_amount', methods=['POST'])
@login_required
def update_process_amount():
    data = request.json
    id = data.get('id')
    new_amount = data.get('amount')

    process = Process.query.filter_by(id=id).first()
    if not process:
        return jsonify({'error': 'Process not found'}), 404

    process.amount = int(new_amount)
    db.session.commit()

    return jsonify({'id': id, 'amount': process.amount})

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
        
    processes = Process.query.filter(Process.id.in_(ids)).all()
    if processes and len(processes) == len(states):
        for process, state in zip(processes, states):
            process.selected = state
        db.session.commit()
    return redirect(url_for('dashboard'))

@app.route('/set_process', methods=['POST'])
@login_required
def set_process():
    if request.method == 'POST':
        # Process submission logic        
        economic = float(request.form['economic'])
        envEmissions = float(request.form['envEmissions'])
        social = int(request.form['social'])
        selected = request.form.get('selected')
        tags = request.form.get('tags').split(',')
        id = request.form.get('id')
        if id is not None:
            id = int(id)

        metrics = {
            'human': float(request.form.get('human', 0) or 0),
            'ground': float(request.form.get('ground', 0) or 0),
            'ores': float(request.form.get('ores', 0) or 0),
            'water': float(request.form.get('water', 0) or 0),
            'oil': float(request.form.get('oil', 0) or 0),
            'gas': float(request.form.get('gas', 0) or 0),
            'economic': economic,
            'envEmissions': envEmissions,
            'social': social
        }

        if selected is None:
            selected = True
        else:
            selected = ast.literal_eval(selected.capitalize())
        amount = request.form.get('process-amount')
        title = request.form['title']  # Add title from the form
        new_process = Process(id=id, title=title, selected=selected, amount=amount, metrics=metrics)
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

        composition_data = ast.literal_eval(request.form.get('composition'))
        for item in composition_data:
            comp_id = item['id']
            comp_amount = item['amount']
            new_composition = Composition(component_process_id=comp_id, composed_process_id=new_process.id, amount=comp_amount)
            db.session.add(new_composition)
        
        db.session.commit()
        return jsonify({})

@app.route('/dashboard', methods=['GET'])
@login_required
def dashboard():
    processes = Process.query.all()
    return render_template('dashboard.html', processes=processes)

@app.route('/get_processes', methods=['GET'])
@login_required
def get_processes():
    processes = Process.query.all()
    process_list = []
    for process in processes:
        composition = Composition.query.filter_by(composed_process_id=process.id).all()
        composition_data = [{'id': comp.component_process_id, 'amount': comp.amount} for comp in composition]
        tags = [tag.name for tag in process.tags]
        process_data = {
            'id': process.id,
            'metrics': process.metrics,
            'selected': process.selected,
            'title': process.title,
            'amount': process.amount,
            'composition': composition_data,
            'tags': tags
        }
        process_list.append(process_data)
    return jsonify(process_list)

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

@app.route('/set_country_resources', methods=['POST'])
@login_required
def set_country_resources():
    data = request.json
    country_resources = {
        'human': {'amount': data.get('human', 0), 'renew_rate': data.get('human_renew_rate', 0)},
        'ground': {'amount': data.get('ground', 0), 'renew_rate': data.get('ground_renew_rate', 0)},
        'ores': {'amount': data.get('ores', 0), 'renew_rate': data.get('ores_renew_rate', 0)},
        'water': {'amount': data.get('water', 0), 'renew_rate': data.get('water_renew_rate', 0)},
        'oil': {'amount': data.get('oil', 0), 'renew_rate': data.get('oil_renew_rate', 0)},
        'gas': {'amount': data.get('gas', 0), 'renew_rate': data.get('gas_renew_rate', 0)},
        'co2capacity': {'amount': data.get('co2capacity', 0), 'renew_rate': data.get('co2capacity_renew_rate', 0)}
        # Add more resources as needed
    }
    country = Country.query.first()
    if not country:
        country = Country(resources=country_resources)
        db.session.add(country)
    else:
        country.resources = country_resources
    db.session.commit()
    return jsonify({'success': True})

@app.route('/get_country_resources', methods=['GET'])
@login_required
def get_country_resources():
    country = Country.query.first()
    if not country:
        return jsonify({
            'human': {'amount': 0, 'renew_rate': 0},
            'ground': {'amount': 0, 'renew_rate': 0},
            'ores': {'amount': 0, 'renew_rate': 0},
            'water': {'amount': 0, 'renew_rate': 0},
            'oil': {'amount': 0, 'renew_rate': 0},
            'gas': {'amount': 0, 'renew_rate': 0},
            'co2capacity': {'amount': 0, 'renew_rate': 0}
            # Add more resources as needed
        })
    return jsonify(country.resources)

@app.route('/simulate_exports_imports', methods=['POST'])
@login_required
def simulate_exports_imports():
    data = request.json
    # Process the import/export simulation based on `data`
    # Update the resources accordingly
    return jsonify({'success': True})

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

if __name__ == "__main__":
    main()
