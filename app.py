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
from converter import convert_document

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

    @app.route('/api/prompt', methods=['GET'])
    def get_prompt():
        """Get current prompt (custom or default)"""
        try:
            custom_prompt = config_manager.get_custom_prompt()

            if custom_prompt:
                return jsonify({'prompt': custom_prompt, 'isCustom': True})
            else:
                # Generate default prompt with current settings
                from converter import build_prompt
                settings = config_manager.get_settings()
                default_prompt = build_prompt(settings, 'example')
                return jsonify({'prompt': default_prompt, 'isCustom': False})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/prompt', methods=['POST'])
    def save_custom_prompt():
        """Save custom prompt"""
        try:
            data = request.get_json()
            custom_prompt = data.get('customPrompt', '').strip()

            if custom_prompt:
                config_manager.save_custom_prompt(custom_prompt)
                return jsonify({'success': True})
            else:
                return jsonify({'error': 'Empty prompt'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/prompt', methods=['DELETE'])
    def delete_custom_prompt():
        """Delete custom prompt (reset to default)"""
        try:
            config_manager.delete_custom_prompt()
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/estimate-cost', methods=['POST'])
    def estimate_cost():
        """Estimate cost before conversion"""
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400

            file = request.files['file']
            settings = config_manager.get_settings()
            page_range = request.form.get('pageRange', '')

            # Save file temporarily
            temp_path = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix).name
            file.save(temp_path)

            # Calculate estimate
            from cost_calculator import estimate_cost_for_file
            estimate = estimate_cost_for_file(
                temp_path,
                settings.get('model', 'claude-sonnet-4-5-20250929'),
                page_range
            )

            os.unlink(temp_path)

            return jsonify(estimate)

        except Exception as e:
            logger.error(f"Cost estimation error: {e}")
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
                # Return JSON with cost and download info
                filename = Path(result['output_path']).name
                return jsonify({
                    'success': True,
                    'filename': filename,
                    'actual_cost': result.get('cost', 0),
                    'download_url': f"/api/download/{filename}"
                })
            else:
                return jsonify({'error': result.get('error', 'Conversion failed')}), 500

        except Exception as e:
            logger.error(f"Conversion error: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/download/<filename>')
    def download_file(filename):
        """Download converted file"""
        try:
            file_path = app.config['UPLOAD_FOLDER'] / filename
            if file_path.exists():
                return send_file(
                    file_path,
                    as_attachment=True,
                    download_name=filename
                )
            else:
                return jsonify({'error': 'File not found'}), 404
        except Exception as e:
            logger.error(f"Download error: {e}")
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
