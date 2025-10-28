// State management
let selectedFile = null;
let hasApiKey = false;

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// Initialize app
async function initializeApp() {
    console.log('Initializing app...');

    // Check if API key is configured
    try {
        const response = await fetch('/api/api-key');
        const data = await response.json();
        hasApiKey = data.hasApiKey;

        if (hasApiKey) {
            showScreen('main-interface');
            loadSettings();
            loadUsageStats();
        } else {
            showScreen('welcome-screen');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showScreen('welcome-screen');
    }
}

// Event listeners setup
function setupEventListeners() {
    // Welcome screen
    document.getElementById('get-started-btn').addEventListener('click', () => {
        showScreen('api-key-screen');
    });

    // API key setup
    document.getElementById('open-anthropic-btn').addEventListener('click', () => {
        window.open('https://console.anthropic.com/settings/keys', '_blank');
    });

    document.getElementById('save-api-key-btn').addEventListener('click', saveApiKey);

    // File selection
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

    // Convert button
    document.getElementById('convert-btn').addEventListener('click', convertDocument);

    // Clear file button
    document.getElementById('clear-file-btn').addEventListener('click', clearSelectedFile);

    // Convert another button
    document.getElementById('convert-another-btn').addEventListener('click', () => {
        clearSelectedFile();
        document.getElementById('success-container').classList.add('hidden');
    });

    // Page range input enable/disable
    document.querySelectorAll('input[name="pageMode"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const rangeInput = document.getElementById('pageRange');
            rangeInput.disabled = this.value === 'all';
            if (this.value === 'all') {
                rangeInput.value = '';
            }
            // Update cost when page mode changes
            updateCostEstimate();
        });
    });

    // Update cost when page range changes
    document.getElementById('pageRange').addEventListener('input', debounce(updateCostEstimate, 500));

    // Prompt editor toggle
    document.getElementById('togglePrompt').addEventListener('click', function() {
        const container = document.getElementById('promptContainer');
        const isVisible = container.style.display !== 'none';
        container.style.display = isVisible ? 'none' : 'block';
        this.textContent = isVisible ? 'Show/Edit' : 'Hide';

        if (!isVisible) {
            // Load current prompt when showing
            loadPrompt();
        }
    });

    // Save custom prompt
    document.getElementById('savePrompt').addEventListener('click', saveCustomPrompt);

    // Reset to default prompt
    document.getElementById('resetPrompt').addEventListener('click', resetPrompt);
}

// API key save
async function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input');
    const errorEl = document.getElementById('api-key-error');
    const statusEl = document.getElementById('api-key-status');
    const saveBtn = document.getElementById('save-api-key-btn');

    const apiKey = apiKeyInput.value.trim();

    // Validate format
    if (!apiKey.startsWith('sk-ant-')) {
        errorEl.textContent = 'Invalid API key format. Should start with sk-ant-';
        errorEl.classList.remove('hidden');
        return;
    }

    errorEl.classList.add('hidden');
    statusEl.textContent = 'Saving API key...';
    statusEl.classList.remove('hidden');
    saveBtn.disabled = true;

    try {
        // Save API key
        const response = await fetch('/api/api-key', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({apiKey})
        });

        if (!response.ok) {
            throw new Error('Failed to save API key');
        }

        statusEl.textContent = 'API key saved! Setup complete...';

        // Show main interface after short delay
        setTimeout(() => {
            showScreen('main-interface');
            loadSettings();
        }, 500);

    } catch (error) {
        errorEl.textContent = 'Error: ' + error.message;
        errorEl.classList.remove('hidden');
        statusEl.classList.add('hidden');
    } finally {
        saveBtn.disabled = false;
    }
}

// Load settings from server
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        // Apply to UI
        document.getElementById('model-select').value = settings.model;
        document.getElementById('page-markers-check').checked = settings.addPageMarkers;
        document.getElementById('replace-signatures-check').checked = settings.replaceSignatures;
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Load usage statistics
async function loadUsageStats() {
    // TODO: Implement if we add usage tracking
    document.getElementById('total-conversions').textContent = '0';
    document.getElementById('total-cost').textContent = '0.00';
}

// Handle file selection
async function handleFileSelect(file) {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF, JPG, or PNG file');
        return;
    }

    selectedFile = file;

    // Show selected file
    document.getElementById('selected-file-name').textContent = file.name;
    document.getElementById('selected-file').classList.remove('hidden');

    // Enable convert button
    document.getElementById('convert-btn').disabled = false;

    // Show page selector for PDFs
    if (file.type === 'application/pdf') {
        document.getElementById('page-selector').classList.remove('hidden');

        // Get page count from backend
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/page-count', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            document.getElementById('pageCount').textContent = `Total pages: ${data.pageCount}`;
        } catch (error) {
            console.error('Failed to get page count:', error);
        }
    } else {
        // Hide page selector for images
        document.getElementById('page-selector').classList.add('hidden');
    }

    // Update cost estimate
    updateCostEstimate();
}

// Clear selected file
function clearSelectedFile() {
    selectedFile = null;
    document.getElementById('selected-file').classList.add('hidden');
    document.getElementById('page-selector').classList.add('hidden');
    document.getElementById('convert-btn').disabled = true;
    document.getElementById('file-input').value = '';

    // Reset page selection
    document.querySelector('input[name="pageMode"][value="all"]').checked = true;
    document.getElementById('pageRange').value = '';
    document.getElementById('pageRange').disabled = true;
}

// Convert document
async function convertDocument() {
    if (!selectedFile) return;

    // Get settings from UI
    const settings = {
        model: document.getElementById('model-select').value,
        addPageMarkers: document.getElementById('page-markers-check').checked,
        replaceSignatures: document.getElementById('replace-signatures-check').checked
    };

    // Show progress
    document.getElementById('progress-container').classList.remove('hidden');
    document.getElementById('convert-btn').disabled = true;

    updateProgress('Uploading file...', 10);

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('settings', JSON.stringify(settings));

        // Add page range if specified
        const pageMode = document.querySelector('input[name="pageMode"]:checked')?.value;
        if (pageMode === 'range') {
            const pageRange = document.getElementById('pageRange').value.trim();
            if (pageRange) {
                formData.append('pageRange', pageRange);
            }
        }

        // Send to server
        const response = await fetch('/api/convert', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Conversion failed');
        }

        const result = await response.json();

        updateProgress('Conversion complete!', 100);

        // Download file
        const downloadResponse = await fetch(result.download_url);
        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        window.URL.revokeObjectURL(url);

        // Show success with actual cost
        showSuccess(result.filename, result.actual_cost);

    } catch (error) {
        alert('Conversion failed: ' + error.message);
        document.getElementById('progress-container').classList.add('hidden');
        document.getElementById('convert-btn').disabled = false;
    }
}

// Update progress display
function updateProgress(status, percent) {
    document.getElementById('progress-status').textContent = status;
    document.getElementById('progress-fill').style.width = percent + '%';
    document.getElementById('progress-fill').textContent = Math.round(percent) + '%';
}

// Show success message
function showSuccess(filename, cost) {
    document.getElementById('progress-container').classList.add('hidden');
    document.getElementById('success-filename').textContent = filename;
    document.getElementById('success-cost').textContent = `Cost: $${cost.toFixed(4)}`;
    document.getElementById('success-container').classList.remove('hidden');

    // Show actual cost
    document.getElementById('actualCostValue').textContent = cost.toFixed(4);
    document.getElementById('actualCost').style.display = 'block';
}

// Load prompt (default or custom)
async function loadPrompt() {
    try {
        const response = await fetch('/api/prompt');
        const data = await response.json();
        document.getElementById('promptEditor').value = data.prompt;
    } catch (error) {
        console.error('Failed to load prompt:', error);
        alert('Failed to load prompt');
    }
}

// Save custom prompt
async function saveCustomPrompt() {
    const customPrompt = document.getElementById('promptEditor').value.trim();

    if (!customPrompt) {
        alert('Prompt cannot be empty');
        return;
    }

    try {
        const response = await fetch('/api/prompt', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({customPrompt: customPrompt})
        });

        if (response.ok) {
            alert('Custom prompt saved successfully!');
        } else {
            alert('Failed to save prompt');
        }
    } catch (error) {
        console.error('Failed to save prompt:', error);
        alert('Failed to save prompt');
    }
}

// Reset to default prompt
async function resetPrompt() {
    if (!confirm('Reset to default prompt? This will remove your custom prompt.')) {
        return;
    }

    try {
        const response = await fetch('/api/prompt', {
            method: 'DELETE'
        });

        if (response.ok) {
            loadPrompt();
            alert('Reset to default prompt');
        } else {
            alert('Failed to reset prompt');
        }
    } catch (error) {
        console.error('Failed to reset prompt:', error);
        alert('Failed to reset prompt');
    }
}

// Update cost estimate
async function updateCostEstimate() {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    // Add page range if specified
    const pageMode = document.querySelector('input[name="pageMode"]:checked')?.value;
    if (pageMode === 'range') {
        const pageRange = document.getElementById('pageRange').value.trim();
        if (pageRange) {
            formData.append('pageRange', pageRange);
        }
    }

    try {
        const response = await fetch('/api/estimate-cost', {
            method: 'POST',
            body: formData
        });

        const estimate = await response.json();

        // Display estimate
        document.getElementById('estPages').textContent = estimate.page_count;
        document.getElementById('estLow').textContent = estimate.estimated_cost_low.toFixed(4);
        document.getElementById('estAvg').textContent = estimate.estimated_cost_avg.toFixed(4);
        document.getElementById('estHigh').textContent = estimate.estimated_cost_high.toFixed(4);
        document.getElementById('costEstimate').style.display = 'block';
    } catch (error) {
        console.error('Failed to estimate cost:', error);
    }
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeApp();
});
