/**
 * PDF to Word Converter v2.0 - Frontend Application
 *
 * Features:
 * - File upload with drag & drop
 * - Real-time WebSocket progress updates
 * - Cost estimation
 * - Usage statistics
 * - API key management
 */

// State
let selectedFile = null;
let currentJobId = null;
let ws = null;

// API base URL
const API_BASE = window.location.origin;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('PDF to Word Converter v2.0 initializing...');

    // Setup event listeners
    setupEventListeners();

    // Check API key status
    await checkApiKeyStatus();

    // Load usage stats
    await loadUsageStats();
});

// Setup all event listeners
function setupEventListeners() {
    // File upload
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // Buttons
    document.getElementById('convert-btn').addEventListener('click', convertDocument);
    document.getElementById('clear-file').addEventListener('click', clearSelectedFile);
    document.getElementById('convert-another-btn').addEventListener('click', resetUI);
    document.getElementById('download-btn').addEventListener('click', downloadResult);
    document.getElementById('error-ok-btn').addEventListener('click', () => {
        document.getElementById('error-section').classList.add('hidden');
    });

    // API key
    document.getElementById('save-api-key-btn').addEventListener('click', saveApiKey);
}

// Check if API key is configured
async function checkApiKeyStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/api-key/status`);
        const data = await response.json();

        if (!data.has_api_key) {
            document.getElementById('api-key-setup').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to check API key status:', error);
    }
}

// Save API key
async function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input');
    const errorEl = document.getElementById('api-key-error');
    const btn = document.getElementById('save-api-key-btn');

    const apiKey = apiKeyInput.value.trim();

    if (!apiKey.startsWith('sk-ant-')) {
        errorEl.textContent = 'Invalid API key format. Should start with sk-ant-';
        errorEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const response = await fetch(`${API_BASE}/api/api-key`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({api_key: apiKey})
        });

        if (!response.ok) {
            throw new Error('Failed to save API key');
        }

        document.getElementById('api-key-setup').classList.add('hidden');
        apiKeyInput.value = '';
        errorEl.classList.add('hidden');

    } catch (error) {
        errorEl.textContent = 'Error: ' + error.message;
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

// Handle file selection
async function handleFileSelect(file) {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF, JPG, or PNG file');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        alert('File too large. Maximum size is 50MB');
        return;
    }

    selectedFile = file;

    // Show selected file
    document.getElementById('selected-file-name').textContent = file.name;
    document.getElementById('file-info').textContent = formatFileSize(file.size);
    document.getElementById('selected-file').classList.remove('hidden');

    // Enable convert button
    document.getElementById('convert-btn').disabled = false;

    // Estimate cost
    await estimateCost();
}

// Clear selected file
function clearSelectedFile() {
    selectedFile = null;
    document.getElementById('selected-file').classList.add('hidden');
    document.getElementById('convert-btn').disabled = true;
    document.getElementById('file-input').value = '';
    document.getElementById('cost-estimate').classList.add('hidden');
}

// Estimate conversion cost
async function estimateCost() {
    if (!selectedFile) return;

    const model = document.querySelector('input[name="model"]:checked').value;

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('model', model);

        const response = await fetch(`${API_BASE}/api/estimate-cost`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to estimate cost');
        }

        const estimate = await response.json();

        // Display estimate
        document.getElementById('est-pages').textContent = estimate.page_count;
        document.getElementById('est-low').textContent = estimate.estimated_cost_low.toFixed(4);
        document.getElementById('est-avg').textContent = estimate.estimated_cost_avg.toFixed(4);
        document.getElementById('est-high').textContent = estimate.estimated_cost_high.toFixed(4);
        document.getElementById('cost-estimate').classList.remove('hidden');

    } catch (error) {
        console.error('Failed to estimate cost:', error);
    }
}

// Convert document
async function convertDocument() {
    if (!selectedFile) return;

    // Get settings
    const settings = {
        font: 'Arial',
        font_size: 12,
        margin: 1.0,
        model: document.querySelector('input[name="model"]:checked').value,
        add_page_markers: document.getElementById('page-markers').checked,
        replace_signatures: document.getElementById('replace-signatures').checked,
        preserve_table_formatting: document.getElementById('preserve-tables').checked,
        handle_merged_cells: true
    };

    // Show progress
    document.getElementById('progress-section').classList.remove('hidden');
    document.getElementById('convert-btn').disabled = true;
    document.getElementById('success-section').classList.add('hidden');
    document.getElementById('error-section').classList.add('hidden');

    updateProgress(0, 'Uploading file...');

    try {
        // Upload and start conversion
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('settings', JSON.stringify(settings));

        const response = await fetch(`${API_BASE}/api/convert`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Conversion failed');
        }

        const result = await response.json();
        currentJobId = result.job_id;

        console.log('Conversion started:', currentJobId);

        // Connect to WebSocket for progress updates
        connectWebSocket(currentJobId);

    } catch (error) {
        console.error('Conversion error:', error);
        showError(error.message);
        document.getElementById('progress-section').classList.add('hidden');
        document.getElementById('convert-btn').disabled = false;
    }
}

// Connect to WebSocket for real-time progress
function connectWebSocket(jobId) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/jobs/${jobId}`;

    console.log('Connecting to WebSocket:', wsUrl);

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
        const update = JSON.parse(event.data);
        console.log('Progress update:', update);

        handleProgressUpdate(update);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket closed');
    };
}

// Handle progress update from WebSocket
function handleProgressUpdate(update) {
    if (update.status === 'processing') {
        updateProgress(update.progress, update.step);
    } else if (update.status === 'completed') {
        updateProgress(100, 'Complete');
        showSuccess(update.output_filename, update.actual_cost);

        if (ws) {
            ws.close();
            ws = null;
        }

        // Reload usage stats
        loadUsageStats();
    } else if (update.status === 'failed') {
        showError(update.error_message || 'Conversion failed');
        document.getElementById('progress-section').classList.add('hidden');

        if (ws) {
            ws.close();
            ws = null;
        }
    }
}

// Update progress UI
function updateProgress(percent, step) {
    document.getElementById('progress-percent').textContent = `${Math.round(percent)}%`;
    document.getElementById('progress-step').textContent = step;
    document.getElementById('progress-bar').style.width = `${percent}%`;
}

// Show success message
function showSuccess(filename, cost) {
    document.getElementById('progress-section').classList.add('hidden');
    document.getElementById('success-filename').textContent = filename || 'Conversion complete';
    document.getElementById('cost-value').textContent = cost ? cost.toFixed(4) : '0.0000';
    document.getElementById('success-section').classList.remove('hidden');
}

// Show error message
function showError(message) {
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-section').classList.remove('hidden');
}

// Download result
async function downloadResult() {
    if (!currentJobId) return;

    try {
        window.location.href = `${API_BASE}/api/download/${currentJobId}`;
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download file');
    }
}

// Reset UI for another conversion
function resetUI() {
    clearSelectedFile();
    document.getElementById('success-section').classList.add('hidden');
    document.getElementById('error-section').classList.add('hidden');
    document.getElementById('progress-section').classList.add('hidden');
    document.getElementById('convert-btn').disabled = true;
    currentJobId = null;

    if (ws) {
        ws.close();
        ws = null;
    }
}

// Load usage statistics
async function loadUsageStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();

        document.getElementById('stat-conversions').textContent = stats.total_conversions;
        document.getElementById('stat-pages').textContent = stats.total_pages;
        document.getElementById('stat-cost').textContent = stats.total_cost.toFixed(2);

    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
