# MateCat Repository Analysis: Architecture for LLM-Based MT Integration

## Executive Summary

MateCat is an **enterprise-level, web-based Computer-Aided Translation (CAT) tool** designed for professional translation workflows. It features a **pluggable MT engine architecture** that allows integration of multiple machine translation providers, making it ideal for adding Claude/OpenAI as a custom MT provider.

---

## 1. PROJECT OVERVIEW

### What is MateCat?
MateCat is a comprehensive translation management system that:
- Enables translation teams to collaborate on documents in real-time
- Manages projects with multiple jobs (language pairs) and segments
- Integrates with multiple MT engines and TM (Translation Memory) systems
- Provides analysis, QA, review workflows, and quality assurance features
- Supports XLIFF format and maintains pre-translated segments

### Key Purposes
1. **Translation Workflow Management**: Complete project lifecycle from upload to download
2. **MT Integration**: Provides MT suggestions and pre-translation capabilities
3. **Quality Assurance**: Includes LQA (Linguistic Quality Assurance) and review features
4. **TM Management**: Integrates with Translation Memory systems
5. **Team Collaboration**: Real-time editing and review capabilities

### Current Version
- **v3.4.12** (as of repo snapshot)
- Active development with recent MT enhancements

---

## 2. CODEBASE STRUCTURE

### Technology Stack

#### Backend
- **Language**: PHP 7.4+
- **Framework**: Klein (lightweight routing framework)
- **Database**: MySQL/MariaDB
- **Queue**: Apache ActiveMQ (STOMP) with Redis caching
- **Key Dependencies**:
  - `phptal/phptal` - Templating
  - `google/apiclient` - Google API client
  - `elasticsearch/elasticsearch` - Search/indexing
  - `orhanerday/open-ai` - OpenAI SDK (already in composer.json!)
  - `predis/predis` - Redis client
  - Various OAuth2 clients (LinkedIn, Microsoft, GitHub, Facebook)

#### Frontend
- **Framework**: React 18+
- **Build**: Webpack 5 with Babel
- **UI**: Semantic UI React
- **State Management**: Flux pattern with immutable.js
- **Testing**: Jest with React Testing Library

### Main Directory Structure

```
MateCat/
├── lib/                          # Backend PHP code (PSR-4 autoloading)
│   ├── Controller/               # HTTP request handlers
│   │   ├── API/                  # REST API endpoints
│   │   │   ├── App/              # Application-level APIs
│   │   │   ├── V2/               # API v2 endpoints
│   │   │   └── V3/               # API v3 endpoints (modern)
│   │   ├── Views/                # View controllers
│   │   └── Features/             # Feature-specific controllers
│   │
│   ├── Model/                    # Data models & business logic
│   │   ├── Projects/             # Project management
│   │   ├── Jobs/                 # Job (language pair) management
│   │   ├── Segments/             # Translation segment handling
│   │   ├── Translations/         # Translation storage & retrieval
│   │   ├── Engines/              # MT/TM engine definitions
│   │   ├── Analysis/             # Translation analysis
│   │   ├── ConnectedServices/    # External service integrations
│   │   └── WordCount/            # Word counting & metrics
│   │
│   ├── Utils/                    # Utility classes
│   │   ├── Engines/              # MT engine implementations
│   │   │   ├── GoogleTranslate.php
│   │   │   ├── DeepL.php
│   │   │   ├── MMT/
│   │   │   ├── Lara/
│   │   │   ├── AbstractEngine.php  # Base class for all engines
│   │   │   ├── EngineInterface.php # Engine contract
│   │   │   └── EnginesFactory.php  # Factory pattern implementation
│   │   ├── AsyncTasks/           # Background job processing
│   │   │   └── Workers/Analysis/ # Analysis daemon workers
│   │   ├── Logger/               # Logging system
│   │   ├── Redis/                # Redis utilities
│   │   └── Constants/            # System constants
│   │
│   ├── Plugins/                  # Plugin system
│   │   └── Features/             # Feature plugins
│   │
│   └── View/                     # Response formatters
│
├── public/                       # Frontend assets
│   ├── js/                       # JavaScript bundles
│   ├── css/                      # Stylesheets
│   ├── api/                      # API entry points
│   └── img/                      # Images
│
├── nodejs/                       # Node.js build tools & utilities
├── plugins/                      # Client-specific plugins
├── migrations/                   # Database schema migrations
├── daemons/                      # Background daemon scripts
└── tests/                        # Test suites
```

---

## 3. CURRENT MT INTEGRATION ARCHITECTURE

### Engine Registry System

#### Database Storage (`engines` table)
MT engines are registered in the `engines` table with:
```sql
CREATE TABLE engines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255),
    type ENUM('MT', 'TM', 'NONE'),
    description TEXT,
    base_url VARCHAR(500),
    translate_relative_url VARCHAR(500),
    class_load VARCHAR(255),          -- PHP class name to instantiate
    extra_parameters JSON,            -- Engine-specific config
    others JSON,                      -- Additional metadata
    google_api_compliant_version INT, -- API version flag
    penalty INT,                      -- Quality penalty for analysis
    active BOOLEAN,
    uid INT,                          -- User ID (NULL for system-wide)
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

#### Pluggable Architecture
```php
class_load Field → Maps to PHP class
                 ├── GoogleTranslate
                 ├── DeepL
                 ├── MicrosoftHub
                 ├── MMT (ModernMT)
                 ├── YandexTranslate
                 ├── SmartMATE
                 ├── Apertium
                 ├── Altlang
                 ├── Lara
                 ├── Intento
                 └── MyMemory (TM/Match)
```

### Engine Implementation Pattern

#### Core Interface: `EngineInterface`
```php
interface EngineInterface {
    public function get(array $_config);              // Translate segments
    public function set($_config);                    // Send feedback
    public function update($_config);                 // Update memory
    public function delete($_config);                 // Delete memory
    public function getConfigStruct();                // Engine config template
    public function getQualityEstimation(...);        // Get QE scores
    public function memoryExists(MemoryKeyStruct);    // Check TM memory
    public function deleteMemory(array);              // Delete TM memory
}
```

#### Base Implementation: `AbstractEngine`
All engines extend `AbstractEngine` which provides:
- CURL request handling with configurable timeouts
- Response parsing and error handling
- Feature set integration
- MT penalty application
- Analysis flag support
- Logging and debugging

#### Example: GoogleTranslate Engine
```php
class GoogleTranslate extends AbstractEngine {
    protected $_config = [
        'q'      => null,        // Query/source text
        'source' => null,        // Source language
        'target' => null,        // Target language
    ];
    
    public function get(array $_config) {
        // 1. Build parameters from config
        // 2. Call Google Translate API
        // 3. Parse response
        // 4. Return MTResponse
    }
}
```

### Engine Factory Pattern
```php
// Load engine by ID from database
$engine = EnginesFactory::getInstance($engineId);

// Or create temporary instance
$engine = EnginesFactory::createTempInstance($engineStruct);
```

**Key benefit**: Engines are loaded dynamically from database, allowing:
- User-specific engine configurations
- Multiple instances of same engine type
- Easy addition of new engines without code changes

### Existing MT Engine Integrations

#### 1. **Google Translate**
- **API Type**: REST (HTTP POST)
- **Config Fields**: API key
- **Languages**: 100+
- **Features**: Basic translation

#### 2. **DeepL**
- **API Type**: REST
- **Config Fields**: API key, base URL
- **Languages**: 29
- **Features**: High-quality translations

#### 3. **Microsoft Hub (Azure Translator)**
- **API Type**: REST
- **Config Fields**: API key, region
- **Languages**: 70+
- **Features**: Multiple API versions supported

#### 4. **ModernMT (MMT)**
- **API Type**: REST with WebSocket
- **Config Fields**: API key, base URL
- **Features**: Adaptive MT with custom memories
- **Dedicated Controller**: `ModernMTController` (V3)
- **Capabilities**:
  - Create/manage custom memories
  - Import glossaries
  - Context-aware translation
  - Batch operations

#### 5. **Lara (Translated.com proprietary)**
- **API Type**: REST
- **Features**: Enterprise MT with connectors

#### 6. **Intento (MT Hub)**
- **API Type**: REST
- **Features**: Switch between multiple MT providers

#### 7. **Yandex Translate**
- **API Type**: REST
- **Features**: Basic translation

#### 8. **SMART-MATE**
- **API Type**: REST
- **Features**: Statistical machine translation

#### 9. **Apertium**
- **API Type**: REST
- **Features**: Open-source rule-based MT

#### 10. **Altlang**
- **API Type**: REST
- **Features**: Specialized translation

---

## 4. TRANSLATION WORKFLOW

### Document Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER UPLOADS PROJECT                         │
│                   (CreateProjectController)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
          ┌──────────────────────────────────┐
          │  File Conversion & Parsing        │
          │  - Extract segments from XLIFF   │
          │  - Create segment records        │
          │  - Detect pre-translated segments│
          └──────────────────┬───────────────┘
                             │
                             ▼
          ┌──────────────────────────────────┐
          │  Project Creation                │
          │  - Insert into projects table    │
          │  - Assign MT engine (id_mt_engine)│
          │  - Assign TM engine (id_tms)     │
          │  - Set status: ANALYZING         │
          └──────────────────┬───────────────┘
                             │
                             ▼
     ┌───────────────────────────────────────────────────┐
     │         FAST ANALYSIS DAEMON (FastAnalysis)      │
     │  - Triggered when project status = ANALYZING     │
     │  - Runs async via ActiveMQ queue                 │
     └─────────────┬─────────────────────────┬──────────┘
                   │                         │
         ┌─────────▼──────────┐    ┌────────▼────────┐
         │  TM Analysis       │    │  MT Analysis    │
         │  (MyMemory)        │    │  (MT Engine)    │
         │  - Find TM matches │    │  - Get suggestions│
         │  - Apply penalties │    │  - Store in DB  │
         │  - 100%, 75-99%, etc.  │                │
         └─────────┬──────────┘    └────────┬────────┘
                   │                         │
                   └───────────┬─────────────┘
                               │
                               ▼
          ┌──────────────────────────────────┐
          │  Analysis Results Stored         │
          │  - segment_translations (MT)     │
          │  - analysis table (match stats)  │
          │  - Project status: FAST_OK       │
          └──────────────────┬───────────────┘
                             │
                             ▼
          ┌──────────────────────────────────┐
          │  EDITOR LOADS PROJECT            │
          │  (CattoolController)             │
          │  - User views segments           │
          │  - MT suggestions displayed      │
          │  - User provides translations    │
          └──────────────────┬───────────────┘
                             │
                             ▼
          ┌──────────────────────────────────┐
          │  SetTranslationController        │
          │  - User submits translation      │
          │  - QA checks performed           │
          │  - Translation version created   │
          │  - Status updated (NEW/DRAFT/etc)│
          └──────────────────┬───────────────┘
                             │
                             ▼
          ┌──────────────────────────────────┐
          │  PROJECT COMPLETION              │
          │  - Review/QA phase (optional)    │
          │  - Export as XLIFF               │
          │  - Status: DONE                  │
          └──────────────────────────────────┘
```

### Segment Structure

Each **Segment** (source text unit) contains:
```php
class SegmentStruct {
    int $id;
    int $id_file;          // Parent file
    int $id_job;           // Parent job/language pair
    string $segment;       // Source text
    int $word_count;
    string $raw_word_count;
    // ... metadata
}
```

Each segment gets ONE **SegmentTranslation** record:
```php
class SegmentTranslationStruct {
    int $id;
    int $id_job;
    int $id_segment;
    string $translation;   // Target text
    int $status;           // NEW, DRAFT, TRANSLATED, APPROVED
    int $version_number;
    array $suggestion_array;  // MT/TM suggestions (JSON)
    // ... timestamps, metadata
}
```

### Pre-Translation Support

MateCat has built-in pre-translation support:

#### 1. **XLIFF Pre-Translation**
- Segments in input XLIFF can have existing translations
- Detected and marked as `is_pre_translated = true` in analysis
- Status: `XLIFF_INTERNAL_STATE`

#### 2. **MT Pre-Translation During Analysis**
```php
// In FastAnalysis daemon:
$perform_Tms_Analysis = true;

if ($engineRecord->id_mt_engine) {
    // Call MT engine for all segments
    $mtResponse = $engine->get([
        'segment' => $segment,
        'source'  => $sourceLanguage,
        'target'  => $targetLanguage
    ]);
    
    // Store in segment_translations
    $translationStruct->translation = $mtResponse->translation;
    $translationStruct->status = TranslationStatus::MT_SUGGESTION;
}
```

#### 3. **Analysis Match Types**
- **100% TM Match**: From Translation Memory
- **75-99% Fuzzy**: Similar TM entries
- **MT Suggestion**: From MT engine
- **Pre-translated**: From XLIFF or prior work

---

## 5. CONFIGURATION & SETTINGS

### Engine Configuration Hierarchy

#### 1. **System-Wide Configuration** (`inc/config.ini`)
```ini
[default]
ENGINES_DB_HOST=localhost
ENGINES_DB_PORT=3306
ENGINES_CACHE_TTL=300

[engines]
GOOGLE_API_KEY=xxxxxxxx
DEEPL_API_KEY=yyyyyyyy
```

#### 2. **Database Engine Configuration**
Stored in `engines` table:
```php
$engine = EngineStruct::getStruct();
$engine->id = 1;
$engine->name = "Google Translate";
$engine->type = "MT";
$engine->class_load = "GoogleTranslate";
$engine->base_url = "https://translation.googleapis.com/language/translate/v2";
$engine->extra_parameters = json_encode([
    'api_version' => 2,
    'default_timeout' => 10
]);
$engine->uid = NULL;  // System-wide
$engine->active = true;

$engineDAO->create($engine);
```

#### 3. **Project-Level Configuration**
Projects reference MT engines:
```php
class ProjectStruct {
    int $id_mt_engine;      // MT engine ID for this project
    int $id_tms;            // TM engine ID
    // ... other configs
}
```

#### 4. **User-Specific Engines**
Users can create personal engine configurations:
```php
$engine->uid = $userId;  // Not NULL - user-specific
```

### API Key Management

#### Secure Storage
- Keys are stored in database `extra_parameters` JSON field
- Access controlled via EngineOwnershipValidator
- User-specific engines only accessible to owning user
- System engines accessible to all users

#### Controllers for Engine Management
```php
// List user's engines
Controller/API/App/EngineController.php

// Add new engine instance
Controller/API/V2/EnginesController.php::listEngines()
```

---

## 6. API STRUCTURE

### REST API Endpoints (Klein Router)

#### Translation Analysis & Suggestions
```
GET/POST /api/projects/[:pid]/jobs/[:jid]/segments         # Get segments
POST /api/[:token]/segment/[:id_job]/[:id_segment]         # Submit translation
GET /api/search/[:id_job]/                                 # Search translations
```

#### MT Engine Management
```
GET /api/engines                                           # List available engines
POST /api/engines/[:id]/test                              # Test engine
GET /api/engines/[:id]/keys                               # Engine-specific operations

# MMT-specific (V3)
GET /api/mmt/[:engineId]/keys                             # Get MMT memories
POST /api/mmt/[:engineId]/glossary                        # Import glossary
PUT /api/mmt/[:engineId]/glossary/[:memoryId]             # Update glossary
```

#### Project Management
```
POST /api/projects/create                                 # Create project
GET /api/projects/[:pid]                                  # Get project details
```

### Request/Response Pattern

#### Example: Translation Request
```
POST /api/[:token]/segment/[1]/[100]
{
    "translation": "Translated text",
    "id_segment": 100,
    "id_job": 1,
    "password": "job_password",
    "suggestion_array": [
        {
            "match": "100",
            "created_by": "mt:GoogleTranslate",
            "creation_date": "2025-01-15"
        }
    ]
}
```

#### Example: MT Suggestion Response
```json
{
    "id": 100,
    "translation": "Texte traduit",
    "status": "MT",
    "version_number": 1,
    "suggestion_array": [
        {
            "match": "MT",
            "data": "Texte traduit",
            "created_by": "GoogleTranslate",
            "creation_date": "2025-01-15T10:30:00Z",
            "match_type": "mt-suggestion"
        }
    ]
}
```

### Authentication & Authorization

#### Token-Based Access
```php
// Login-based access
LoginValidator ensures user is authenticated

// Token-based access (for sharing)
Each project/job has a sharing token
Validates password when provided
```

#### Engine Ownership
```php
EngineOwnershipValidator {
    - User can only access their own engines
    - System engines (uid=NULL) accessible to all
    - Admin engines restricted by role
}
```

---

## 7. KEY ARCHITECTURAL PATTERNS

### Factory Pattern
```php
// EnginesFactory creates engine instances dynamically
$engine = EnginesFactory::getInstance($engineId);
$className = EnginesFactory::getFullyQualifiedClassName($classLoad);
```

### Template Method Pattern
```php
// AbstractEngine defines translation flow
// Subclasses implement specific API calls
class GoogleTranslate extends AbstractEngine {
    protected function _decode($rawValue, $parameters) { ... }
}
```

### Plugin Architecture
```php
lib/Plugins/Features/ - Extended functionality
- TranslationVersions
- ReviewExtended
- TranslationEvents
- Various client-specific plugins
```

### Async Task Queue
```php
Utils/AsyncTasks/Workers/
- FastAnalysis processes analysis async
- TMAnalysisWorker handles TM lookups
- Tasks queued via Apache ActiveMQ
- Processed by daemon scripts
```

---

## 8. DATABASE KEY TABLES

### Core Tables

#### `projects`
```
id, id_team, name, source_language, target_languages,
id_mt_engine, id_tms, status, create_date, updated_date, ...
```

#### `jobs` (Language pairs)
```
id, id_project, source, target, id_mt_engine, id_tms,
status, created_at, updated_at, ...
```

#### `files`
```
id, id_job, filename, file_content, created_date, ...
```

#### `segments`
```
id, id_file, id_job, segment, word_count, created_date, ...
```

#### `segment_translations`
```
id, id_job, id_segment, translation, status, version_number,
suggestion_array, created_at, updated_at, ...
```

#### `engines`
```
id, name, type (MT/TM/NONE), class_load, base_url,
translate_relative_url, extra_parameters (JSON), 
active, uid (NULL=system-wide), ...
```

#### `analysis`
```
id_job, id_segment, match_type, match_quality,
created_at, modified_at, ...
```

---

## 9. CUSTOM INTEGRATION POINTS FOR CLAUDE/OPENAI

### Where to Integrate LLM MT

#### Option 1: **Full Document Pre-Translation** (Recommended)
Create a new controller that:
1. Receives project ID and optional custom prompt
2. Fetches all segments in the job
3. Groups segments for batch processing (e.g., 10-20 segments per API call)
4. Calls Claude API with custom system prompt + document context
5. Stores results in `segment_translations` table with status `MT_SUGGESTION`
6. Updates analysis table with match type `MT`

#### Option 2: **Per-Segment Translation** (Real-time)
Integrate Claude as an engine:
1. Create `Claude.php` class extending `AbstractEngine`
2. Implement `get()` method to call Claude API
3. Register in database as MT engine
4. Called during analysis phase for each segment

### Implementation Steps

#### 1. **Create Engine Class**
```php
// lib/Utils/Engines/Claude.php
namespace Utils\Engines;

class Claude extends AbstractEngine {
    public function get(array $_config) {
        // Call Anthropic API
        // Format as MTResponse
        // Return result
    }
}
```

#### 2. **Add to Engine Constants**
```php
// lib/Utils/Constants/EngineConstants.php
const CLAUDE = 'Claude';
protected static array $ENGINES_LIST = [
    // ... existing engines
    Claude::class => Claude::class,
];
```

#### 3. **Create Engine Struct**
```php
// lib/Model/Engines/Structs/ClaudeStruct.php
class ClaudeStruct extends EngineStruct {
    public function __construct() {
        // Set default Claude configuration
        $this->type = EngineConstants::MT;
        $this->class_load = Claude::class;
        $this->base_url = 'https://api.anthropic.com/v1';
        // ... etc
    }
}
```

#### 4. **Create Pre-Translation Controller** (Optional)
```php
// lib/Controller/API/App/ClaudePreTranslateController.php
class ClaudePreTranslateController extends AbstractStatefulKleinController {
    public function pretranslate() {
        // Get project/job
        // Fetch all segments
        // Call Claude with custom prompt
        // Store results
        // Update analysis
    }
}
```

#### 5. **Register Routes** (in router.php)
```php
route('/api/jobs/:job_id/pretranslate-claude', 'POST', 
    [ClaudePreTranslateController::class, 'pretranslate']);
```

### Custom Prompt Support

MateCat already has custom prompt support in the existing PDF converter. To add it here:

```php
class ProjectTemplateStruct {
    // Add new field
    public ?string $claude_system_prompt = null;
    public ?string $claude_user_prompt_template = null;
    // {source_text}, {source_lang}, {target_lang} available as vars
}
```

Store prompts in:
- Database: `project_templates` table (for reuse across projects)
- UI: Settings screen where users can customize prompts per project

---

## 10. EXAMPLE: GOOGLE TRANSLATE IMPLEMENTATION

Understanding how Google Translate is implemented helps with Claude integration:

```php
class GoogleTranslate extends AbstractEngine {
    protected $_config = [
        'q'      => null,
        'source' => null,
        'target' => null,
    ];
    
    public function get(array $_config) {
        $parameters = [];
        
        // Get API key from engine config
        if ($this->client_secret != '' && $this->client_secret != null) {
            $parameters['key'] = $this->client_secret;
        }
        
        // Prepare request parameters
        $parameters['target'] = $this->_fixLangCode($_config['target']);
        $parameters['source'] = $this->_fixLangCode($_config['source']);
        $parameters['q'] = $_config['segment'];
        
        // Configure CURL
        $this->_setAdditionalCurlParams([
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($parameters)
        ]);
        
        // Make API call
        $this->call("translate_relative_url", $parameters, true);
        
        // Result is parsed by _decode() method
        return $this->result;
    }
    
    protected function _decode($rawValue, $parameters = [], $function = null) {
        // Parse JSON response
        $decoded = json_decode($rawValue, true);
        
        if (isset($decoded["data"])) {
            // Extract translation and create MTResponse
            return $this->_composeMTResponseAsMatch(
                $parameters['q'], 
                $decoded
            );
        } else {
            // Handle error response
            return ['error' => [...$decoded["error"]]];
        }
    }
}
```

---

## 11. INTEGRATION CHECKLIST FOR CLAUDE

### Phase 1: Basic Engine Integration
- [ ] Create `Claude.php` engine class extending `AbstractEngine`
- [ ] Implement `get()` method to call Anthropic API
- [ ] Implement `_decode()` to parse API response as `MTResponse`
- [ ] Create `ClaudeStruct.php` with default configuration
- [ ] Add `Claude::class` to `EngineConstants`
- [ ] Register Claude engine in database via migration
- [ ] Test single-segment translation via API

### Phase 2: Pre-Translation Controller
- [ ] Create `ClaudePreTranslateController.php`
- [ ] Implement full-document pre-translation logic
- [ ] Handle batch segmentation (e.g., 15-20 segments per request)
- [ ] Store results in `segment_translations` with MT status
- [ ] Update `analysis` table with match stats
- [ ] Add route to router.php
- [ ] Test with sample projects

### Phase 3: Custom Prompts
- [ ] Add prompt fields to `ProjectTemplateStruct`
- [ ] Create database migration for new fields
- [ ] Add prompt UI in settings
- [ ] Pass custom prompt to Claude API
- [ ] Support template variables (e.g., {source_text}, {target_lang})
- [ ] Store prompt history/versions

### Phase 4: Advanced Features
- [ ] Cost estimation (tokens → cost mapping)
- [ ] Quality metrics (BLEURT/similar)
- [ ] Adaptive MT with feedback loop
- [ ] Memory/context management for long documents
- [ ] Language-pair specific configurations
- [ ] Fallback to other engines if Claude fails

### Phase 5: UI Integration
- [ ] Add Claude to engine selection dropdown
- [ ] Show cost estimates
- [ ] Display pre-translation progress
- [ ] Allow prompt customization per project
- [ ] Show translation quality metrics
- [ ] Track API usage

---

## 12. SECURITY CONSIDERATIONS

### API Key Management
```php
// API keys stored in extra_parameters JSON
// Accessed via EngineStruct->getExtraParamsAsArray()
// Should be encrypted in database

// Recommended: Use Defuse PHP Encryption
use Defuse\Crypto\Crypto;

$encrypted = Crypto::encrypt($apiKey, $encryptionKey);
// Store $encrypted in database
```

### Access Control
```php
// EngineOwnershipValidator ensures:
// - User can only use their own engines
// - System engines require permission
// - Rate limiting per user/engine

// ClaudePreTranslateController should validate:
// - User owns the project
// - User has assigned Claude as MT engine
// - Quota/rate limits not exceeded
```

### Data Privacy
- Segments sent to Claude API
- Consider GDPR/data residency requirements
- Option to implement local proxy/gateway
- Log API calls for audit trail

---

## 13. PERFORMANCE CONSIDERATIONS

### Batch Processing
```php
// Don't send each segment individually
// Group 15-20 segments with context:

$batch = [
    "segments" => [
        "Hello, how are you?",
        "I am fine.",
        "Thank you."
    ],
    "context" => "Casual conversation",
    "document_type" => "Dialogue",
];

// Call Claude API once for batch
// Parse multiple translations in response
```

### Caching
```php
// Cache Claude responses by segment hash
Redis::setex(
    "segment:hash:response", 
    86400,  // 24 hours
    json_encode($response)
);
```

### Async Processing
```php
// Use existing ActiveMQ queue for long-running pre-translations
// Create new worker: ClaudePreTranslationWorker
// Callback updates UI when complete
```

---

## 14. DEBUGGING & LOGGING

### Engine Logging
```php
// All engines log via LoggerFactory
$this->logger = LoggerFactory::getLogger('engines');
$this->logger->info("Claude translation", [
    'segment_id' => $segmentId,
    'tokens' => $tokenCount,
    'cost' => $estimatedCost
]);
```

### Log Locations
```
storage/
├── logs/
│   ├── engines.log          # MT engine operations
│   ├── fastAnalysis.log     # Analysis daemon
│   ├── fatal_errors.txt     # Exception logs
│   └── ...
```

---

## CONCLUSION

MateCat's pluggable engine architecture makes it ideal for integrating Claude as an MT provider. The system already has:
- ✅ Engine registration and factory pattern
- ✅ Pre-translation infrastructure
- ✅ Async task queue for batch processing
- ✅ Analysis/match type system
- ✅ Custom prompt support (via projects metadata)
- ✅ API key management
- ✅ Logging and monitoring

**Recommended approach**: Create a `Claude.php` engine class for segment-level translation, plus an optional `ClaudePreTranslateController` for full-document pre-translation with custom prompts.

The integration can be done with **2-3 new PHP classes** and **1-2 database migrations**, leveraging MateCat's existing infrastructure extensively.

