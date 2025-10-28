"""
Flask web server for PDF to Word converter.

Serves browser-based UI and provides API endpoints for:
- File upload and conversion
- Settings management
- API key configuration
- Skill upload
"""

import os
import tempfile
import logging
import webbrowser
from threading import Timer
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from werkzeug.utils import secure_filename

from config_manager import ConfigManager
from converter import upload_skill, convert_document

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize config manager
config_manager = ConfigManager()


def create_app(testing=False):
    """Application factory"""
    app = Flask(__name__, static_folder='static', static_url_path='/static')

    if testing:
        app.config['TESTING'] = True

    # Configure upload folder
    UPLOAD_FOLDER = Path.home() / '.pdf-converter' / 'uploads'
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max

    @app.route('/')
    def index():
        """Serve main UI"""
        # For now, serve static HTML file
        return send_from_directory('static', 'index.html')

    @app.route('/api/health')
    def health_check():
        """Health check endpoint"""
        return jsonify({'status': 'ok'})

    @app.route('/api/settings', methods=['GET'])
    def get_settings():
        """Get user settings"""
        try:
            settings = config_manager.get_settings()
            return jsonify(settings)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/settings', methods=['POST'])
    def save_settings():
        """Save user settings"""
        try:
            settings = request.get_json()
            config_manager.save_settings(settings)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/api-key', methods=['GET'])
    def get_api_key_status():
        """Check if API key is configured"""
        try:
            has_key = config_manager.has_api_key()
            return jsonify({'hasApiKey': has_key})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/api-key', methods=['POST'])
    def save_api_key():
        """Save API key"""
        try:
            data = request.get_json()
            api_key = data.get('apiKey')

            if not api_key or not api_key.startswith('sk-ant-'):
                return jsonify({'error': 'Invalid API key format'}), 400

            config_manager.save_api_key(api_key)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/skill-upload', methods=['POST'])
    def upload_skill_to_account():
        """Upload skill to user's Anthropic account"""
        try:
            api_key = config_manager.get_api_key()
            if not api_key:
                return jsonify({'error': 'API key not configured'}), 400

            skill_id = upload_skill(api_key)

            if skill_id:
                config_manager.save_skill_id(skill_id)
                return jsonify({'success': True, 'skillId': skill_id})
            else:
                return jsonify({
                    'success': False,
                    'error': 'Skill upload failed, will use embedded fallback'
                })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/page-count', methods=['POST'])
    def get_page_count():
        """Get PDF page count"""
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400

            file = request.files['file']
            if not file.filename.endswith('.pdf'):
                return jsonify({'error': 'Not a PDF file'}), 400

            # Save temporarily
            temp_path = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf').name
            file.save(temp_path)

            # Get page count
            from pypdf import PdfReader
            reader = PdfReader(temp_path)
            page_count = len(reader.pages)

            os.unlink(temp_path)

            return jsonify({'pageCount': page_count})

        except Exception as e:
            logger.error(f"Page count error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/convert', methods=['POST'])
    def convert_file():
        """Convert uploaded file to Word"""
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400

            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'Empty filename'}), 400

            # Save uploaded file
            filename = secure_filename(file.filename)
            file_path = app.config['UPLOAD_FOLDER'] / filename
            file.save(file_path)

            # Get settings
            settings = config_manager.get_settings()
            api_key = config_manager.get_api_key()
            skill_id = config_manager.get_skill_id()

            if not api_key:
                return jsonify({'error': 'API key not configured'}), 400

            # Get page range if provided
            page_range = request.form.get('pageRange', '')

            # Convert
            result = convert_document(
                str(file_path),
                settings,
                api_key,
                page_range=page_range,
                skill_id=skill_id
            )

            if result['success']:
                # Return the file
                return send_file(
                    result['output_path'],
                    as_attachment=True,
                    download_name=Path(result['output_path']).name
                )
            else:
                return jsonify({'error': result.get('error', 'Conversion failed')}), 500

        except Exception as e:
            logger.error(f"Conversion error: {e}")
            return jsonify({'error': str(e)}), 500

    return app


def open_browser():
    """Open browser to app URL after startup delay"""
    webbrowser.open('http://127.0.0.1:5000')


if __name__ == '__main__':
    # Start browser after 1 second
    Timer(1, open_browser).start()

    # Run Flask app
    app = create_app()
    app.run(host='127.0.0.1', port=5000, debug=False)
