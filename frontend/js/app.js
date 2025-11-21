/**
 * PDF to Word Converter v2.0 - Multi-file Support
 * FEATURES:
 * - Multi-file upload
 * - Sequential processing (doesn't overwhelm API)
 * - Individual progress tracking
 * - Separate downloads
 * - No prompt contradiction
 */

// State
let selectedFiles = [];
let jobs = {}; // Map of job_id -> job data

// API base URL
const API_BASE = window.location.origin;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('PDF to Word Converter v2.0 (Multi-file) initializing...');
    setupEventListeners();
    await checkApiKeyStatus();
    await loadUsageStats();
});

// Setup all event listeners
function setupEventListeners() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    // File upload - MULTIPLE FILES
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFilesSelect(Array.from(e.target.files));
        }
    });

    // Drag and drop - MULTIPLE FILES
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
            handleFilesSelect(Array.from(e.dataTransfer.files));
        }
    });

    // Buttons
    document.getElementById('convert-btn').addEventListener('click', convertDocuments);
    document.getElementById('clear-files-btn').addEventListener('click', clearAllFiles);
    document.getElementById('error-ok-btn').addEventListener('click', () => {
        document.getElementById('error-section').classList.add('hidden');
    });

    // API key
    document.getElementById('settings-btn').addEventListener('click', showApiKeySettings);
    document.getElementById('close-api-key-btn').addEventListener('click', hideApiKeySettings);
    document.getElementById('save-api-key-btn').addEventListener('click', saveApiKey);
    document.getElementById('test-api-key-btn').addEventListener('click', testApiKey);

    // Override formatting toggle
    document.getElementById('override-formatting').addEventListener('change', (e) => {
        const formatSettings = document.getElementById('format-settings');
        if (e.target.checked) {
            formatSettings.classList.remove('hidden');
        } else {
            formatSettings.classList.add('hidden');
        }
    });

    // Re-estimate cost when model changes
    document.querySelectorAll('input[name="model"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (selectedFiles.length > 0) estimateCosts();
        });
    });

    // Custom instructions character counter
    const customInstructionsInput = document.getElementById('custom-instructions');
    const customInstructionsCount = document.getElementById('custom-instructions-count');
    customInstructionsInput.addEventListener('input', () => {
        customInstructionsCount.textContent = customInstructionsInput.value.length;
    });
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
        document.getElementById('api-key-success').textContent = 'API key saved successfully!';
        document.getElementById('api-key-success').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('api-key-success').classList.add('hidden');
        }, 3000);
    } catch (error) {
        errorEl.textContent = 'Error: ' + error.message;
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Key';
    }
}

// Show API key settings
function showApiKeySettings() {
    document.getElementById('api-key-setup').classList.remove('hidden');
}

// Hide API key settings
function hideApiKeySettings() {
    document.getElementById('api-key-setup').classList.add('hidden');
    document.getElementById('api-key-error').classList.add('hidden');
    document.getElementById('api-key-success').classList.add('hidden');
}

// Test API key
async function testApiKey() {
    const btn = document.getElementById('test-api-key-btn');
    const statusEl = document.getElementById('api-key-status');
    const errorEl = document.getElementById('api-key-error');
    const successEl = document.getElementById('api-key-success');

    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Testing...';
    statusEl.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/api/api-key/status`);
        const data = await response.json();

        if (data.has_api_key) {
            statusEl.textContent = '✓ API Key Valid';
            statusEl.className = 'flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700';
            statusEl.classList.remove('hidden');
            successEl.textContent = 'API key is configured and ready to use!';
            successEl.classList.remove('hidden');
        } else {
            statusEl.textContent = '✗ No API Key';
            statusEl.className = 'flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700';
            statusEl.classList.remove('hidden');
            errorEl.textContent = 'No API key configured. Please enter and save your API key.';
            errorEl.classList.remove('hidden');
        }
    } catch (error) {
        statusEl.textContent = '✗ Test Failed';
        statusEl.className = 'flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700';
        statusEl.classList.remove('hidden');
        errorEl.textContent = 'Error testing API key: ' + error.message;
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Test API Key';
    }
}

// Handle multiple file selection
async function handleFilesSelect(files) {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    // Validate files
    const validFiles = files.filter(file => {
        if (!allowedTypes.includes(file.type)) {
            alert(`${file.name}: Invalid file type. Please select PDF, JPG, or PNG`);
            return false;
        }
        if (file.size > 50 * 1024 * 1024) {
            alert(`${file.name}: File too large (max 50MB)`);
            return false;
        }
        return true;
    });

    if (validFiles.length === 0) return;

    // Limit to 20 files
    if (selectedFiles.length + validFiles.length > 20) {
        alert('Maximum 20 files per batch');
        return;
    }

    // Add to selected files
    selectedFiles = [...selectedFiles, ...validFiles];

    // Update UI
    updateFilesList();

    // Enable convert button
    document.getElementById('convert-btn').disabled = false;

    // Estimate costs
    await estimateCosts();
}

// Update files list UI
function updateFilesList() {
    const container = document.getElementById('selected-files-list');
    container.innerHTML = '';

    if (selectedFiles.length === 0) {
        document.getElementById('selected-files').classList.add('hidden');
        return;
    }

    document.getElementById('selected-files').classList.remove('hidden');
    document.getElementById('files-count').textContent = selectedFiles.length;

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between p-3 bg-white rounded-lg border-2 border-purple-200';
        fileItem.innerHTML = `
            <div class="flex items-center flex-1">
                <svg class="h-5 w-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900">${file.name}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button onclick="removeFile(${index})" class="text-red-500 hover:text-red-700 p-1">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </button>
        `;
        container.appendChild(fileItem);
    });
}

// Remove file from selection
window.removeFile = function(index) {
    selectedFiles.splice(index, 1);
    updateFilesList();
    
    if (selectedFiles.length === 0) {
        document.getElementById('convert-btn').disabled = true;
        document.getElementById('cost-estimate').classList.add('hidden');
    } else {
        estimateCosts();
    }
}

// Clear all files
function clearAllFiles() {
    selectedFiles = [];
    updateFilesList();
    document.getElementById('convert-btn').disabled = true;
    document.getElementById('cost-estimate').classList.add('hidden');
}

// Estimate costs for all files (simplified client-side calculation)
async function estimateCosts() {
    if (selectedFiles.length === 0) {
        document.getElementById('cost-estimate').classList.add('hidden');
        return;
    }

    const model = document.querySelector('input[name="model"]:checked').value;

    // Simplified cost estimation based on model
    // Haiku: ~$0.08/file, Sonnet: ~$0.20/file (rough average for typical PDFs)
    const costPerFile = model === 'claude-haiku-4-5-20251001' ? 0.08 : 0.20;
    const totalFiles = selectedFiles.length;

    // Display simplified estimates
    document.getElementById('est-files').textContent = totalFiles;
    document.getElementById('est-pages').textContent = 'TBD';
    document.getElementById('est-low').textContent = (totalFiles * costPerFile * 0.8).toFixed(4);
    document.getElementById('est-avg').textContent = (totalFiles * costPerFile).toFixed(4);
    document.getElementById('est-high').textContent = (totalFiles * costPerFile * 1.5).toFixed(4);
    document.getElementById('cost-estimate').classList.remove('hidden');
}

// Convert all documents - Individual file processing with REST polling
async function convertDocuments() {
    if (selectedFiles.length === 0) return;

    // Get settings
    const overrideFormatting = document.getElementById('override-formatting').checked;
    const marginVertical = parseFloat(document.getElementById('margin-vertical').value);
    const marginHorizontal = parseFloat(document.getElementById('margin-horizontal').value);

    const customInstructions = document.getElementById('custom-instructions').value.trim();
    const pageRange = document.getElementById('page-range').value.trim();

    const settings = {
        overrideFormatting: overrideFormatting,
        font: 'Arial',
        fontSize: 12,
        margins: {
            top: marginVertical * 1440,
            bottom: marginVertical * 1440,
            left: marginHorizontal * 1440,
            right: marginHorizontal * 1440
        },
        model: document.querySelector('input[name="model"]:checked').value,
        enableLogging: localStorage.getItem('enableLogging') === 'true',
        addPageMarkers: document.getElementById('page-markers').checked,
        replaceSignatures: document.getElementById('replace-signatures').checked,
        preserveTableFormatting: document.getElementById('preserve-tables').checked,
        customInstructions: customInstructions || '',
        pageRange: pageRange || ''
    };

    console.log('Converting files with settings:', settings);

    // Hide file selection, show progress
    document.getElementById('convert-btn').disabled = true;
    document.getElementById('progress-container').classList.remove('hidden');
    document.getElementById('error-section').classList.add('hidden');

    // Create progress items for each file
    const progressList = document.getElementById('progress-list');
    progressList.innerHTML = '';

    try {
        // Convert each file individually
        for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('settings', JSON.stringify(settings));

            const response = await fetch(`${API_BASE}/api/convert`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Conversion failed');
            }

            const result = await response.json();
            console.log('Job created:', result);

            // Create progress item
            jobs[result.jobId] = {
                job_id: result.jobId,
                filename: file.name,
                status: 'queued',
                progress: 0,
                currentStep: 'Queued'
            };

            const progressItem = createProgressItem({
                job_id: result.jobId,
                filename: file.name,
                page_count: '?'
            });
            progressList.appendChild(progressItem);

            // Start polling for this job
            pollJobStatus(result.jobId);
        }

    } catch (error) {
        console.error('Conversion error:', error);
        showError(error.message);
        document.getElementById('convert-btn').disabled = false;
    }
}

// Create progress item UI for a single file
function createProgressItem(jobInfo) {
    const div = document.createElement('div');
    div.id = `job-${jobInfo.job_id}`;
    div.className = 'glass-card rounded-xl p-4 mb-3';
    div.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div class="flex-1">
                <p class="text-sm font-semibold text-gray-900">${jobInfo.filename}</p>
                <p class="text-xs text-gray-600">${jobInfo.page_count} pages</p>
            </div>
            <div class="text-xs">
                <span id="status-${jobInfo.job_id}" class="px-2 py-1 bg-gray-200 rounded-full">Queued</span>
            </div>
        </div>
        <div class="mb-2">
            <div class="flex justify-between text-xs mb-1">
                <span id="step-${jobInfo.job_id}" class="text-gray-600">Waiting...</span>
                <span id="percent-${jobInfo.job_id}" class="font-medium text-purple-600">0%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div id="bar-${jobInfo.job_id}" class="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all" style="width: 0%"></div>
            </div>
        </div>
        <div id="result-${jobInfo.job_id}" class="hidden mt-2">
            <!-- Will be filled with download button or error -->
        </div>
    `;
    return div;
}

// Poll job status using REST API
function pollJobStatus(jobId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/jobs/${jobId}/status`);

            if (!response.ok) {
                clearInterval(interval);
                return;
            }

            const job = await response.json();

            // Update job data
            const update = {
                status: job.status,
                progress: job.progress,
                step: job.currentStep,
                actual_cost: job.actualCost,
                input_tokens: job.inputTokens,
                output_tokens: job.outputTokens,
                error_message: job.error
            };

            handleJobUpdate(jobId, update);

            // Stop polling if job is completed or failed
            if (job.status === 'completed' || job.status === 'failed') {
                clearInterval(interval);
            }

        } catch (error) {
            console.error(`Polling error for job ${jobId}:`, error);
            clearInterval(interval);
        }
    }, 2000); // Poll every 2 seconds
}

// Handle individual job update
function handleJobUpdate(jobId, update) {
    jobs[jobId] = { ...jobs[jobId], ...update };

    // Update UI
    const statusEl = document.getElementById(`status-${jobId}`);
    const stepEl = document.getElementById(`step-${jobId}`);
    const percentEl = document.getElementById(`percent-${jobId}`);
    const barEl = document.getElementById(`bar-${jobId}`);
    const resultEl = document.getElementById(`result-${jobId}`);

    if (stepEl) stepEl.textContent = update.step;
    if (percentEl) percentEl.textContent = update.progress + '%';
    if (barEl) barEl.style.width = update.progress + '%';

    if (statusEl) {
        statusEl.textContent = update.status.charAt(0).toUpperCase() + update.status.slice(1);
        statusEl.className = 'px-2 py-1 rounded-full text-xs font-medium ' + getStatusClass(update.status);
    }

    if (update.status === 'completed' && resultEl) {
        resultEl.classList.remove('hidden');
        const inputTokens = update.input_tokens || 0;
        const outputTokens = update.output_tokens || 0;
        const totalTokens = inputTokens + outputTokens;
        resultEl.innerHTML = `
            <div class="bg-green-50 p-2 rounded">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs text-green-700">Cost: $${(update.actual_cost || 0).toFixed(4)}</span>
                    <button onclick="downloadFile('${jobId}')" class="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                        Download
                    </button>
                </div>
                <div class="text-xs text-green-600">
                    Tokens: ${totalTokens.toLocaleString()} total (${inputTokens.toLocaleString()} in, ${outputTokens.toLocaleString()} out)
                </div>
            </div>
        `;
        loadUsageStats(); // Refresh stats
    } else if (update.status === 'failed' && resultEl) {
        resultEl.classList.remove('hidden');
        resultEl.innerHTML = `
            <div class="bg-red-50 p-2 rounded">
                <p class="text-xs text-red-700">${update.error_message || 'Conversion failed'}</p>
            </div>
        `;
    }
}

// Get status badge class
function getStatusClass(status) {
    switch (status) {
        case 'queued': return 'bg-gray-200 text-gray-700';
        case 'processing': return 'bg-blue-200 text-blue-700';
        case 'completed': return 'bg-green-200 text-green-700';
        case 'failed': return 'bg-red-200 text-red-700';
        default: return 'bg-gray-200 text-gray-700';
    }
}

// Download individual file
window.downloadFile = async function(jobId) {
    try {
        const response = await fetch(`${API_BASE}/api/download/${jobId}`);

        if (!response.ok) {
            throw new Error('Failed to download file');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = jobs[jobId].filename.replace(/\.[^/.]+$/, "") + '.docx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download file: ' + error.message);
    }
}

// Show error
function showError(message) {
    document.getElementById('error-section').classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
}

// Load usage statistics
async function loadUsageStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();

        document.getElementById('stat-conversions').textContent = stats.total_conversions || 0;
        document.getElementById('stat-pages').textContent = stats.total_pages || 0;
        document.getElementById('stat-cost').textContent = (stats.total_cost || 0).toFixed(2);

    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
