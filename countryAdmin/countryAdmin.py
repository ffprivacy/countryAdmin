from flask import Flask, render_template, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize Flask app
app = Flask(__name__)

# Configure SQLAlchemy for database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///processes.db'
db = SQLAlchemy(app)

# Define Process model
class Process(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    process_id = db.Column(db.Integer, unique=True, nullable=False)
    economic = db.Column(db.Float)
    environmental = db.Column(db.Float)
    social = db.Column(db.Integer)
    selected = db.Column(db.Boolean, default=False)  # Define selected attribute here

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
    db.session.commit()
    return redirect(url_for('dashboard'))

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
    id = request.form.get('id')
    process = Process.query.get(id)
    if process:
        process.selected = not process.selected
        db.session.commit()
    return redirect(url_for('dashboard'))

@app.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    if request.method == 'POST':
        # Process submission logic
        economic = float(request.form['economic'])
        environmental = float(request.form['environmental'])
        social = int(request.form['social'])
        process_id = int(request.form['process_id'])
        new_process = Process(process_id=process_id, economic=economic, environmental=environmental, social=social, selected=True)  # selected=True
        db.session.add(new_process)
        db.session.commit()

    processes = Process.query.all()

    # Calculate total metrics for each kind in the selected governance
    selected_processes = Process.query.filter_by(selected=True).all()
    total_economic = sum(process.economic for process in selected_processes)
    total_environmental = sum(process.environmental for process in selected_processes)
    total_social = sum(process.social for process in selected_processes)

    return render_template('dashboard.html', processes=processes, total_economic=total_economic, total_environmental=total_environmental, total_social=total_social)


def main():
    app.run(debug=True, port=5000)

if __name__ == "__main__":
    main()