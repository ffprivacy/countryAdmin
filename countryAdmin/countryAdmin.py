from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import ast, copy

# Initialize Flask app
app = Flask(__name__)

# Configure SQLAlchemy for database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///processes.db'
db = SQLAlchemy(app)

class Federation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    followed_federations = db.Column(db.PickleType, default=[])

# Ensure the database and tables are created before the first request
with app.app_context():
    db.create_all()
    if not Federation.query.first():
        default_federation = Federation(name="village", followed_federations=[])
        db.session.add(default_federation)
        db.session.commit()

@app.route('/identify', methods=['GET'])
def identify():
    federation = Federation.query.first()
    if federation:
        return jsonify(name=federation.name, followed_federations=federation.followed_federations)
    return jsonify(name=None, followed_federations=[])

@app.route('/follow_federation', methods=['POST'])
def follow_federation():
    data = request.json
    federation_name = data.get('federation_name')
    hostname = data.get('hostname')
    if federation_name and hostname:
        try:
            federation = Federation.query.filter_by().first()
            if federation:
                followed_federations = copy.deepcopy(federation.followed_federations) or []
                if not any(fed['name'] == federation_name for fed in followed_federations):
                    followed_federations.append({'name': federation_name, 'hostname': hostname})
                    federation.followed_federations = followed_federations
                    db.session.commit()
                    return jsonify(success=True)
                else:
                    return jsonify(success=False, error="Federation already followed"), 400
            else:
                return jsonify(success=False, error="No federation in base"), 404
        except Exception as e:
            return jsonify(success=False, error=str(e)), 500
    else:
        return jsonify(success=False, error="Federation name and hostname are required"), 400

@app.route('/unfollow_federation', methods=['POST'])
def unfollow_federation():
    data = request.json
    federation_name = data.get('federation_name')
    federation = Federation.query.first()
    if federation_name and federation:
        federation.followed_federations = [fed for fed in federation.followed_federations if fed['name'] != federation_name]
        db.session.commit()
    return jsonify(success=True)

@app.route('/change_federation_name', methods=['POST'])
def change_federation_name():
    data = request.json
    new_name = data.get('new_name')
    federation = Federation.query.first()
    if new_name and federation:
        federation.name = new_name
        db.session.commit()
    return jsonify(success=True)

# Define Composition model
class Composition(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    composed_process_id = db.Column(db.Integer, db.ForeignKey('process.id'), nullable=False)
    component_process_id = db.Column(db.Integer, nullable=False)
    amount = db.Column(db.Integer, nullable=False)
   
# Define Process model
class Process(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    process_id = db.Column(db.Integer, unique=False, nullable=False)
    economic = db.Column(db.Float)
    envEmissions = db.Column(db.Float)
    social = db.Column(db.Integer)
    title = db.Column(db.String(100))  # Add title attribute
    selected = db.Column(db.Boolean, default=False)
    amount = db.Column(db.Integer)
    composition = db.relationship('Composition', backref='process', lazy=True)

# Define User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Ensure database tables are created
with app.app_context():
    db.create_all()

# Routes
@app.route('/')
def index():
    return render_template('dashboard.html')

@app.route('/reset_database', methods=['POST'])
def reset_database():
    # Delete all records in the Process table
    db.session.query(Process).delete()
    db.session.query(Composition).delete()
    db.session.query(Federation).delete()
    db.session.commit()
    return redirect(url_for('dashboard'))

@app.route('/update_process_amount', methods=['POST'])
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
                # TODO: Implement session management for logged in users
                return redirect(url_for('dashboard'))
        else:
            # Create new user if not in database
            new_user = User(username=username)
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            # TODO: Implement session management for newly created user
            return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/select_process', methods=['POST'])
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

@app.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    if request.method == 'POST':
        # Process submission logic        
        economic = float(request.form['economic'])
        envEmissions = float(request.form['envEmissions'])
        social = int(request.form['social'])
        process_id = int(request.form['process_id'])
        selected = request.form.get('selected')
        id = request.form.get('id')
        if id is not None:
            id = int(id)

        if selected is None:
            selected = True
        else:
            selected = ast.literal_eval(selected.capitalize())
        amount = request.form.get('process-amount')
        title = request.form['title']  # Add title from the form
        new_process = Process(id=id,process_id=process_id, economic=economic, envEmissions=envEmissions, social=social, title=title, selected=selected, amount=amount)
        db.session.add(new_process)
        db.session.commit()

        composition_data = ast.literal_eval(request.form.get('composition'))
        for item in composition_data:
            comp_id = item['id']
            comp_amount = item['amount']
            new_composition = Composition(component_process_id=comp_id, composed_process_id=new_process.id, amount=comp_amount)
            db.session.add(new_composition)
        
        db.session.commit()


    processes = Process.query.all()

    return render_template('dashboard.html', processes=processes)

# Endpoint to retrieve processes as JSON
@app.route('/get_processes', methods=['GET'])
def get_processes():
    processes = Process.query.all()
    process_list = []
    for process in processes:
        composition = Composition.query.filter_by(composed_process_id=process.id).all()
        composition_data = [{'id': comp.component_process_id, 'amount': comp.amount} for comp in composition]
        process_data = {
            'id': process.id,
            'process_id': process.process_id,
            'metrics': {
                'economic': process.economic,
                'envEmissions': process.envEmissions,
                'social': process.social,
            },
            'selected': process.selected,
            'title': process.title,
            'amount': process.amount,
            'composition': composition_data
        }
        process_list.append(process_data)
    return jsonify(process_list)

def main():
    app.run(debug=True, port=5000)

if __name__ == "__main__":
    main()
