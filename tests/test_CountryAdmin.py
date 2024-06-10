import pytest
from countryadmin.countryAdmin import app, db, User, Process
from werkzeug.security import generate_password_hash
from io import BytesIO

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['WTF_CSRF_ENABLED'] = False

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            # Pre-populate the database with a test user
            test_user = User(username='testuser', password_hash=generate_password_hash('testpass'))
            db.session.add(test_user)
            db.session.commit()
        yield client

def login(client, username, password):
    return client.post('/login', data=dict(
        username=username,
        password=password
    ), follow_redirects=True)

def logout(client):
    return client.get('/logout', follow_redirects=True)

def test_login_logout(client):
    """Test logging in and logging out."""
    response = login(client, 'testuser', 'testpass')
    assert b'Dashboard' in response.data

    response = logout(client)
    assert b'Login' in response.data

def test_get_processes(client):
    """Test retrieving all processes."""
    login(client, 'testuser', 'testpass')
    response = client.get('/get_processes')
    assert response.status_code == 200
    assert b'[]' in response.data  # Expecting an empty list initially

def test_get_process(client):
    """Test retrieving a single process by ID."""
    login(client, 'testuser', 'testpass')
    # Create a process to test retrieval
    process = Process(title="Test Process", amount=100, selected=False)
    db.session.add(process)
    db.session.commit()

    response = client.get(f'/get_process/{process.id}')
    assert response.status_code == 200
    assert b'Test Process' in response.data

def test_add_process(client):
    """Test adding a new process."""
    login(client, 'testuser', 'testpass')
    response = client.post('/set_process', json={
        'title': 'New Process',
        'amount': 150,
        'selected': True,
        'tags': ['tag1', 'tag2'],
        'metrics': {'economic': 200}
    })
    assert response.status_code == 200
    assert b'success' in response.data

def test_update_process(client):
    """Test updating an existing process."""
    login(client, 'testuser', 'testpass')
    process = Process(title="Old Process", amount=50, selected=True)
    db.session.add(process)
    db.session.commit()

    response = client.post(f'/update_process_amount', json={
        'id': process.id,
        'amount': 200
    })
    assert response.status_code == 200
    assert b'200' in response.data

def test_delete_process(client):
    """Test deleting a process."""
    login(client, 'testuser', 'testpass')
    process = Process(title="Delete Me", amount=100, selected=True)
    db.session.add(process)
    db.session.commit()

    response = client.post(f'/delete_process/{process.id}')
    assert response.status_code == 200
    assert b'success' in response.data

def test_reset_database(client):
    """Test the reset database functionality."""
    login(client, 'testuser', 'testpass')
    response = client.post('/reset_database')
    assert response.status_code == 302  # Should redirect to logout

def test_get_nonexistent_process(client):
    """Test retrieving a process that does not exist."""
    login(client, 'testuser', 'testpass')
    response = client.get('/get_process/999')  # Assuming 999 is an ID that does not exist
    assert response.status_code == 404
    assert b'Process not found' in response.data

def test_like_process(client):
    """Test liking a process."""
    login(client, 'testuser', 'testpass')
    process = Process(title="Like Process", amount=100, selected=True)
    db.session.add(process)
    db.session.commit()

    response = client.post(f'/like_process/{process.id}')
    assert response.status_code == 200
    assert b'success' in response.data

def test_dislike_process(client):
    """Test disliking a process."""
    login(client, 'testuser', 'testpass')
    process = Process(title="Dislike Process", amount=100, selected=True)
    db.session.add(process)
    db.session.commit()

    response = client.post(f'/dislike_process/{process.id}')
    assert response.status_code == 200
    assert b'success' in response.data

def test_unauthorized_access(client):
    """Test access to a protected endpoint without logging in."""
    response = client.get('/get_processes')
    assert response.status_code == 302  # Expecting redirect to login page
    assert '/login' in response.headers['Location']

def test_add_comment(client):
    """Test adding a comment to a process."""
    login(client, 'testuser', 'testpass')
    process = Process(title="Commentable Process", amount=50, selected=True)
    db.session.add(process)
    db.session.commit()

    response = client.post(f'/add_comment/{process.id}', json={'comment': 'Great process!'})
    assert response.status_code == 200
    assert b'success' in response.data

def test_export_database(client):
    """Test exporting the database."""
    login(client, 'testuser', 'testpass')
    response = client.get('/export_database')
    assert response.status_code == 200
    assert 'application/octet-stream' in response.content_type

def test_import_database(client):
    """Test importing a database file."""
    login(client, 'testuser', 'testpass')
    data = {'file': (BytesIO(b'test data'), 'test.db')}
    response = client.post('/import_database', data=data, content_type='multipart/form-data')
    assert response.status_code == 200
    assert b'success' in response.data
