import pytest
from app import create_app


@pytest.fixture
def client():
    """Create test client"""
    app = create_app(testing=True)
    with app.test_client() as client:
        yield client


def test_index_route_returns_html(client):
    """Test main route serves HTML"""
    response = client.get('/')
    assert response.status_code == 200
    assert b'DOCTYPE html' in response.data or b'PDF to Word Converter' in response.data


def test_api_settings_get(client):
    """Test getting settings"""
    response = client.get('/api/settings')
    assert response.status_code == 200
    data = response.get_json()
    assert 'font' in data
    assert 'model' in data


def test_api_health_check(client):
    """Test health check endpoint"""
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
