# LLM-Integrated CAT Tool: Comprehensive Architecture & Design

**Created**: November 15, 2024
**Project**: Claude-Powered MateCat Integration
**Status**: Design Phase

---

## TABLE OF CONTENTS

1. [Core Architecture](#core-architecture)
2. [Glossary & Translation Memory Connection](#glossary--translation-memory-connection)
3. [Prompt System (Primary + Secondary)](#prompt-system-primary--secondary)
4. [Learning Loop & Feedback](#learning-loop--feedback)
5. [Reference Files Integration](#reference-files-integration)
6. [Enhanced Find & Replace](#enhanced-find--replace)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Considerations & Future Improvements](#considerations--future-improvements)

---

## CORE ARCHITECTURE

### System Overview

```
PROJECT UPLOAD
    ↓
CONTEXT ANALYSIS (Async)
├─ Extract segments
├─ Load glossaries (General + Project-specific)
├─ Index Translation Memory
├─ Process reference files
└─ Generate project metadata
    ↓
PROMPT GENERATION
├─ Primary Prompt (for main translation)
├─ Secondary Prompts Library (alternatives, analysis, etc.)
├─ Context Injection (glossary + TM + references)
└─ Custom Instructions (user-defined)
    ↓
PRE-TRANSLATION (Batch)
├─ Send segments in batches to Claude API
├─ Include enriched context
└─ Store suggestions with confidence scores
    ↓
SEGMENT-BY-SEGMENT REVIEW
├─ Display LLM suggestion
├─ Show glossary terms used
├─ Show TM matches
├─ Show reference file snippets
├─ User accepts/edits
└─ Optional: Run secondary prompts (alternatives, analysis, etc.)
    ↓
LEARNING LOOP
├─ Track user corrections
├─ Analyze patterns
├─ Update/suggest prompt improvements
└─ Re-translate remaining segments with improved prompt
    ↓
PROJECT COMPLETION
└─ Export with improved glossary/TM for next project
```

---

## GLOSSARY & TRANSLATION MEMORY CONNECTION

### Architecture: General + Project-Specific

**Database Structure:**

```sql
-- GLOSSARY ENTRIES (General + Project-Specific)
CREATE TABLE `glossary_entries` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `id_glossary` INT NOT NULL,
  `id_project` INT DEFAULT NULL,  -- NULL = general, VALUE = project override
  `source_term` VARCHAR(255) NOT NULL,
  `target_term` VARCHAR(255) NOT NULL,
  `context` TEXT,                 -- When to use
  `part_of_speech` VARCHAR(50),   -- noun, verb, adjective
  `domain` VARCHAR(100),          -- technical, legal, marketing
  `alternatives` JSON,            -- Alternative translations
  `mandatory` BOOLEAN DEFAULT 1,  -- Must use this translation
  `importance` INT DEFAULT 1,     -- 1-5 scale
  `created_at` TIMESTAMP,
  FOREIGN KEY (`id_glossary`) REFERENCES `glossaries`(`id`),
  FOREIGN KEY (`id_project`) REFERENCES `projects`(`id`)
);

Example:
┌────┬──────────┬────────────┬──────────┬─────────────┬──────────────┐
│ id │ gloss_id │ id_project │ source   │ target      │ mandatory    │
├────┼──────────┼────────────┼──────────┼─────────────┼──────────────┤
│ 1  │ 1        │ NULL       │ "cloud"  │ "nube"      │ 0            │ -- General
│ 2  │ 1        │ NULL       │ "platform"│"plataforma" │ 1            │ -- General, strict
│ 3  │ 1        │ 42         │ "cloud"  │ "infraest.."│ 1            │ -- Project override
└────┴──────────┴────────────┴──────────┴─────────────┴──────────────┘

-- TRANSLATION MEMORY (General + Project-Specific)
CREATE TABLE `segment_translations` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `id_job` INT,
  `id_project` INT,              -- Track which project for filtering
  `source` TEXT NOT NULL,
  `target` TEXT NOT NULL,
  `match_type` VARCHAR(50),      -- 'perfect', 'fuzzy', 'pending'
  `translator_id` INT,           -- Who created this translation
  `created_at` TIMESTAMP,
  FOREIGN KEY (`id_project`) REFERENCES `projects`(`id`)
);
```

### How Context is Built for LLM

```php
// lib/Utils/LLM/ContextBuilder.php
class ContextBuilder {

    public function buildGlossaryContext($segmentText, $projectId) {
        // Get glossary terms (project-specific override general)
        $projectTerms = DB::table('glossary_entries')
            ->where('id_project', $projectId)
            ->get()
            ->keyBy('source_term');

        $generalTerms = DB::table('glossary_entries')
            ->whereNull('id_project')
            ->get()
            ->keyBy('source_term');

        // Merge: project overrides general
        $allTerms = [];
        foreach ($generalTerms as $source => $term) {
            $allTerms[$source] = $term;
        }
        foreach ($projectTerms as $source => $term) {
            $allTerms[$source] = $term; // Override
        }

        // Find terms in segment
        $termsInSegment = [];
        foreach ($allTerms as $source => $term) {
            if (stripos($segmentText, $source) !== false) {
                $termsInSegment[] = [
                    'source' => $source,
                    'target' => $term->target_term,
                    'mandatory' => $term->mandatory,
                    'importance' => $term->importance
                ];
            }
        }

        // Sort by importance & mandatory flag
        usort($termsInSegment, fn($a, $b) =>
            ($b['mandatory'] <=> $a['mandatory']) ?:
            ($b['importance'] <=> $a['importance'])
        );

        return $termsInSegment;
    }

    public function buildTMContext($segmentText, $projectId, $minSimilarity = 0.75) {
        // First: Project-specific TM (highest priority)
        $projectMatches = $this->findSimilarSegments(
            $segmentText,
            $projectId,
            $minSimilarity
        );

        // If not enough: Add general TM (secondary priority)
        if (count($projectMatches) < 2) {
            $generalMatches = $this->findSimilarSegments(
                $segmentText,
                null,  // No project filter = all projects
                $minSimilarity
            );
            $projectMatches = array_merge($projectMatches, $generalMatches);
        }

        return array_slice($projectMatches, 0, 5); // Return top 5
    }

    private function findSimilarSegments($text, $projectId, $minSimilarity) {
        $query = DB::table('segment_translations')
            ->select('source', 'target', 'match_type');

        if ($projectId) {
            $query->where('id_project', $projectId);
        }

        $allSegments = $query->get();

        $matches = [];
        foreach ($allSegments as $seg) {
            $similarity = $this->calculateSimilarity($text, $seg->source);
            if ($similarity >= $minSimilarity) {
                $matches[] = [
                    'source' => $seg->source,
                    'target' => $seg->target,
                    'similarity' => round($similarity * 100),
                    'match_type' => $seg->match_type
                ];
            }
        }

        usort($matches, fn($a, $b) => $b['similarity'] <=> $a['similarity']);
        return $matches;
    }

    private function calculateSimilarity($str1, $str2) {
        $lev = levenshtein(strtolower($str1), strtolower($str2));
        $maxLen = max(strlen($str1), strlen($str2));
        return 1 - ($lev / $maxLen);
    }

    public function formatContextString($glossaryTerms, $tmMatches, $references = []) {
        $output = "";

        if (!empty($glossaryTerms)) {
            $output .= "GLOSSARY TERMS IN THIS SEGMENT:\n";
            foreach ($glossaryTerms as $term) {
                $flag = $term['mandatory'] ? "STRICT" : "preferred";
                $output .= "- '{$term['source']}' → '{$term['target']}' ({$flag})\n";
            }
            $output .= "\n";
        }

        if (!empty($tmMatches)) {
            $output .= "SIMILAR TRANSLATIONS FROM MEMORY:\n";
            foreach ($tmMatches as $match) {
                $output .= "- [{$match['similarity']}%] '{$match['source']}' → '{$match['target']}'\n";
            }
            $output .= "\n";
        }

        if (!empty($references)) {
            $output .= "RELEVANT REFERENCE EXCERPTS:\n";
            foreach ($references as $ref) {
                $output .= "- From {$ref['file']}: {$ref['excerpt']}\n";
            }
            $output .= "\n";
        }

        return $output;
    }
}
```

---

## PROMPT SYSTEM (PRIMARY + SECONDARY)

### Primary Prompt (For Main Translation)

Used for all segment translations. Structure:

```
[SYSTEM_INSTRUCTIONS]
You are a professional translator.
Always respect glossary terms as mandatory.
Consider Translation Memory examples.
Follow style guide rules.

[CUSTOM_PROMPT]
[User-defined instructions specific to this project]

[GLOSSARY_CONTEXT]
[Auto-injected from database]

[TM_CONTEXT]
[Auto-injected from database]

[REFERENCE_CONTEXT]
[Auto-injected from style guides/brand guidelines]

---
Translate (maintain context with previous/next segment):
Previous: "{PREV_SEGMENT}"
CURRENT: "{CURRENT_SEGMENT}"
Next: "{NEXT_SEGMENT}"
```

### Secondary Prompts Library

Alternative prompts for different tasks:

**Built-in Templates:**

| ID | Name | Purpose | Input Variables |
|----|------|---------|-----------------|
| 1 | Find Alternatives | Generate 3-5 alternative translations | `term`, `context`, `audience` |
| 2 | Analyze Term | Explain term meaning and nuances | `term`, `source_lang`, `target_lang` |
| 3 | Improve Style | Make translation sound more natural | `translation`, `context`, `tone` |
| 4 | Check Terminology | Verify glossary term compliance | `translation`, `glossary_json` |
| 5 | Tone Analysis | Verify tone matches source | `translation`, `source`, `target_tone` |
| 6 | Consistency Check | Verify terminology consistency | `translation`, `previous_segments` |
| 7 | Grammar Review | Check grammar/syntax | `translation`, `target_lang` |
| 8 | Cultural Adaptation | Check cultural appropriateness | `translation`, `source`, `target_audience` |

**Database:**

```sql
CREATE TABLE `llm_prompt_library` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `id_project` INT NOT NULL,
  `prompt_type` ENUM('primary', 'secondary'),
  `name` VARCHAR(255),
  `description` TEXT,
  `category` VARCHAR(100),  -- 'alternatives', 'analysis', 'styling', 'qa'
  `prompt_content` LONGTEXT,
  `input_variables` JSON,   -- ["term", "context"]
  `is_active` BOOLEAN DEFAULT 1,
  `version` INT,
  `created_at` TIMESTAMP,
  FOREIGN KEY (`id_project`) REFERENCES `projects`(`id`)
);
```

**Usage in Editor:**

```
Segment Review:
┌─────────────────────────────────────┐
│ SOURCE: "Our cloud platform..."     │
├─────────────────────────────────────┤
│ [PRIMARY] [Alternatives▼] [Analyze▼]│
│ [Style▼] [Check Terms▼] [More▼]    │
│                                     │
│ PRIMARY:                            │
│ [Nuestra plataforma nube...]        │
│ [Accept] [Edit]                     │
│                                     │
│ ALTERNATIVES (click tab):           │
│ Option 1: "...infraestructura..."   │
│ Option 2: "...solución..."          │
│ Option 3: "...sistema..."           │
│ [Use #1] [Use #2] [Use #3]          │
│                                     │
│ ANALYZE (click tab):                │
│ Term: "platform"                    │
│ - English: broad concept            │
│ - Spanish: "plataforma"             │
│ - Tech context: preferred           │
│ [Close]                             │
└─────────────────────────────────────┘
```

---

## LEARNING LOOP & FEEDBACK

### Correction Tracking

```sql
CREATE TABLE `llm_correction_history` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `id_project` INT NOT NULL,
  `id_segment` INT NOT NULL,
  `llm_output` LONGTEXT,
  `user_correction` LONGTEXT,
  `error_type` ENUM(
    'terminology', 'style', 'grammar',
    'structure', 'tone', 'completeness', 'other'
  ),
  `correction_priority` INT,  -- 1-5
  `impact_on_prompt` BOOLEAN,
  `created_at` TIMESTAMP,
  FOREIGN KEY (`id_project` REFERENCES `projects`(`id`),
  FOREIGN KEY (`id_segment` REFERENCES `segments`(`id`)
);
```

### Learning Engine

```php
// lib/Utils/LLM/LearningEngine.php
class LearningEngine {

    public function processUserCorrection($segmentId, $llmOutput, $userInput, $projectId) {
        // 1. Analyze the difference
        $diff = $this->analyzeDifference($llmOutput, $userInput);

        // 2. Classify error type
        $errorType = $this->classifyError($diff);

        // 3. Store correction
        $correction = new CorrectionHistory([
            'id_project' => $projectId,
            'id_segment' => $segmentId,
            'llm_output' => $llmOutput,
            'user_correction' => $userInput,
            'error_type' => $errorType,
            'correction_priority' => $this->calculatePriority($errorType)
        ]);
        $correction->save();

        // 4. Check if should trigger learning
        if ($this->shouldLearn($projectId, $errorType)) {
            $this->triggerPromptRefinement($projectId);
        }
    }

    private function shouldLearn($projectId, $errorType) {
        // Learn if:
        // - Same error type appears 3+ times
        // - Priority is high (4-5)
        // - Or after every 10 corrections

        $recentSameType = DB::table('llm_correction_history')
            ->where('id_project', $projectId)
            ->where('error_type', $errorType)
            ->orderBy('created_at', 'DESC')
            ->limit(3)
            ->count();

        return $recentSameType >= 3;
    }

    public function triggerPromptRefinement($projectId) {
        // Get patterns from recent corrections
        $recentCorrections = DB::table('llm_correction_history')
            ->where('id_project', $projectId)
            ->orderBy('created_at', 'DESC')
            ->limit(10)
            ->get();

        $patterns = $this->analyzePatterns($recentCorrections);

        // Generate refined prompt
        $currentPrompt = $this->getActivePrompt($projectId);
        $newPrompt = $this->refinePrompt($currentPrompt, $patterns);

        // Create new version
        $version = new PromptVersion([
            'id_project' => $projectId,
            'version_number' => $this->getNextVersion($projectId),
            'prompt_content' => $newPrompt,
            'is_active' => false,
            'quality_score' => 0
        ]);
        $version->save();

        // Notify user of improvement
        $this->notifyPromptImprovement($projectId, $patterns, $version);
    }

    private function refinePrompt($currentPrompt, $patterns) {
        $refined = $currentPrompt;

        // Add refinements based on patterns
        if ($patterns['terminology_errors'] > 2) {
            $refined .= "\n[REFINED] Strictly adhere to glossary. No alternatives.";
        }

        if ($patterns['style_errors'] > 2) {
            $refined .= "\n[REFINED] Maintain " . $this->inferTone($patterns) . " tone consistently.";
        }

        if ($patterns['structure_errors'] > 2) {
            $refined .= "\n[REFINED] Maintain source sentence structure. Don't restructure.";
        }

        return $refined;
    }
}
```

### Prompt Versioning

```sql
CREATE TABLE `llm_prompt_versions` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `id_project` INT NOT NULL,
  `version_number` INT,
  `prompt_content` LONGTEXT,
  `is_active` BOOLEAN DEFAULT 0,
  `quality_score` FLOAT,       -- Calculated from corrections
  `segments_tested` INT,
  `corrections_avoided` INT,   -- How many corrections did this version prevent
  `created_at` TIMESTAMP,
  FOREIGN KEY (`id_project` REFERENCES `projects`(`id`)
);
```

---

## REFERENCE FILES INTEGRATION

### File Types & Processing

```sql
CREATE TABLE `llm_reference_files` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `id_project` INT NOT NULL,
  `file_name` VARCHAR(255),
  `file_type` ENUM(
    'style_guide', 'brand_guidelines',
    'examples', 'terminology_list', 'other'
  ),
  `content` LONGTEXT,        -- Extracted text
  `category` VARCHAR(100),   -- e.g., 'tone', 'terminology', 'formatting'
  `importance` INT DEFAULT 1, -- 1-5 weight
  `chunks` JSON,             -- Split content for semantic search
  `embeddings` JSON,         -- Vector embeddings for similarity
  `created_at` TIMESTAMP,
  FOREIGN KEY (`id_project` REFERENCES `projects`(`id`)
);
```

### Semantic Search in References

```php
// lib/Utils/LLM/ReferenceFileProcessor.php
class ReferenceFileProcessor {

    public function uploadAndProcess($projectId, $file, $category, $importance) {
        // 1. Extract text
        $content = $this->extractText($file);

        // 2. Chunk content
        $chunks = $this->chunkContent($content, 200); // tokens

        // 3. Generate embeddings
        $embeddings = array_map(
            fn($chunk) => $this->generateEmbedding($chunk),
            $chunks
        );

        // 4. Store
        $refFile = new ReferenceFile([
            'id_project' => $projectId,
            'file_name' => $file->getClientOriginalName(),
            'file_type' => $category,
            'content' => $content,
            'importance' => $importance,
            'chunks' => json_encode($chunks),
            'embeddings' => json_encode($embeddings)
        ]);
        $refFile->save();

        return $refFile;
    }

    public function findRelevantExcerpts($projectId, $segmentText, $topK = 3) {
        // Get query embedding
        $queryEmbed = $this->generateEmbedding($segmentText);

        // Search all reference files
        $refFiles = DB::table('llm_reference_files')
            ->where('id_project', $projectId)
            ->get();

        $results = [];
        foreach ($refFiles as $file) {
            $chunks = json_decode($file->chunks, true);
            $embeddings = json_decode($file->embeddings, true);

            foreach ($chunks as $idx => $chunk) {
                $similarity = $this->cosineSimilarity($queryEmbed, $embeddings[$idx]);

                if ($similarity > 0.6) { // Threshold
                    $results[] = [
                        'chunk' => $chunk,
                        'file' => $file->file_name,
                        'category' => $file->file_type,
                        'importance' => $file->importance,
                        'similarity' => $similarity
                    ];
                }
            }
        }

        // Sort by importance then similarity
        usort($results, fn($a, $b) =>
            ($b['importance'] <=> $a['importance']) ?:
            ($b['similarity'] <=> $a['similarity'])
        );

        return array_slice($results, 0, $topK);
    }

    private function generateEmbedding($text) {
        // Use OpenAI Embeddings API
        $response = $this->openaiClient->embeddings()->create([
            'model' => 'text-embedding-3-small',
            'input' => $text,
        ]);

        return $response['data'][0]['embedding'];
    }

    private function cosineSimilarity($vec1, $vec2) {
        $dotProduct = array_sum(array_map(fn($a, $b) => $a * $b, $vec1, $vec2));
        $mag1 = sqrt(array_sum(array_map(fn($x) => $x ** 2, $vec1)));
        $mag2 = sqrt(array_sum(array_map(fn($x) => $x ** 2, $vec2)));

        return ($mag1 && $mag2) ? $dotProduct / ($mag1 * $mag2) : 0;
    }
}
```

---

## ENHANCED FIND & REPLACE

### Current MateCat Behavior
- Searches full project
- Highlights all occurrences
- Shows entire project view

### New Smart Find & Replace

```
SEARCH UI:
┌──────────────────────────────────────┐
│ SMART FIND & REPLACE                 │
├──────────────────────────────────────┤
│ Find in SOURCE: [input]              │
│ Find in TARGET: [input]              │
│ [Match Case] [Whole Word] [Fuzzy]   │
│ Fuzzy Threshold: [85%]               │
│ [Search]                             │
└──────────────────────────────────────┘

FILTERED RESULTS (Only matching segments):
┌──────────────────────────────────────┐
│ Segment 12 (1 of 7)                  │
│ SOURCE: "Our DIGITAL solutions"      │
│ TARGET: "Nuestras soluciones DIGITAL"│
│ [Replace] [Replace All] [Skip]       │
│ [Next] [Prev]                        │
└──────────────────────────────────────┘
```

### Implementation

```php
// lib/Controller/API/V2/SmartFindReplaceController.php
class SmartFindReplaceController {

    public function search() {
        $sourceFind = $_POST['source_find'] ?? null;
        $targetFind = $_POST['target_find'] ?? null;
        $caseSensitive = $_POST['case_sensitive'] ?? false;
        $wholeWord = $_POST['whole_word'] ?? false;
        $fuzzyMatch = $_POST['fuzzy_match'] ?? false;
        $fuzzyThreshold = $_POST['fuzzy_threshold'] ?? 85;

        $jobId = $_POST['id_job'];

        // Get all segments
        $segments = DB::table('segments')
            ->where('id_job', $jobId)
            ->get();

        $matchingSegments = [];

        foreach ($segments as $segment) {
            $sourceMatches = $this->matchesFilter(
                $segment->source,
                $sourceFind,
                $caseSensitive,
                $wholeWord,
                $fuzzyMatch,
                $fuzzyThreshold
            );

            $targetMatches = $targetFind ?
                $this->matchesFilter(
                    $segment->target,
                    $targetFind,
                    $caseSensitive,
                    $wholeWord,
                    $fuzzyMatch,
                    $fuzzyThreshold
                ) : true;

            // Both must match if both are provided
            if ($sourceMatches && ($targetFind === null || $targetMatches)) {
                $matchingSegments[] = [
                    'id' => $segment->id,
                    'source' => $segment->source,
                    'target' => $segment->target,
                    'source_matches' => $sourceMatches,
                    'target_matches' => $targetMatches
                ];
            }
        }

        return json_encode([
            'total_matches' => count($matchingSegments),
            'segments' => $matchingSegments
        ]);
    }

    private function matchesFilter($text, $searchTerm, $caseSensitive, $wholeWord, $fuzzy, $threshold) {
        if (!$searchTerm) return true;

        $searchText = $caseSensitive ? $text : strtolower($text);
        $searchTerm = $caseSensitive ? $searchTerm : strtolower($searchTerm);

        // Exact match
        if ($wholeWord) {
            $words = preg_split('/\s+/', $searchText);
            return in_array($searchTerm, $words);
        }

        if (stripos($searchText, $searchTerm) !== false) {
            return true;
        }

        // Fuzzy match
        if ($fuzzy) {
            $words = preg_split('/\s+/', $searchText);
            foreach ($words as $word) {
                $similarity = (levenshtein($searchTerm, $word) / strlen($searchTerm)) * 100;
                if ($similarity >= $threshold) {
                    return true;
                }
            }
        }

        return false;
    }
}
```

---

## IMPLEMENTATION ROADMAP

### Phase 1: Core LLM Engine & Context (Week 1-2)
- [ ] Claude.php and OpenAI.php engine classes
- [ ] ContextBuilder service (glossary + TM + custom prompt)
- [ ] Primary prompt templating
- [ ] Database migrations (glossary, TM, project config)
- [ ] Pre-translate endpoint
- [ ] Basic UI button for pre-translation

### Phase 2: Segment-by-Segment Editor (Week 2-3)
- [ ] Enhanced editor display with glossary highlighting
- [ ] LLM suggestion display with confidence
- [ ] Edit interface with diff tracking
- [ ] Correction history storage
- [ ] Accept/reject/edit workflow

### Phase 3: Learning Loop (Week 4-5)
- [ ] LearningEngine service
- [ ] Correction pattern detection
- [ ] Automatic prompt refinement
- [ ] Prompt versioning & A/B testing
- [ ] Re-translation of remaining segments

### Phase 4: Secondary Prompts Library (Week 5-6)
- [ ] Built-in secondary prompt templates
- [ ] Secondary prompt UI tabs in editor
- [ ] Custom prompt creation workflow
- [ ] API endpoints for running secondary prompts

### Phase 5: Reference Files (Week 6-7)
- [ ] File upload service (PDF, DOCX, XLSX, CSV)
- [ ] Text extraction from files
- [ ] Embedding generation and storage
- [ ] Semantic search in references
- [ ] Reference context injection into prompts
- [ ] Reference file UI in project settings

### Phase 6: Enhanced Find & Replace (Week 7-8)
- [ ] Smart filtering by source/target
- [ ] Fuzzy matching support
- [ ] Segment-only display mode
- [ ] Batch replace with preview
- [ ] UI updates

### Phase 7: Testing & Optimization (Week 8-9)
- [ ] End-to-end testing
- [ ] Performance optimization (caching, batching)
- [ ] Cost tracking and optimization
- [ ] UI polish and usability
- [ ] Documentation

---

## CONSIDERATIONS & FUTURE IMPROVEMENTS

### Architecture Decisions

**Glossary & TM Strategy:** Separate (General + Project-Specific with override)
- ✅ Company-wide consistency
- ✅ Project flexibility
- ✅ Knowledge sharing across projects

**Learning Trigger:** Pattern-based (3+ same error type)
- ✅ Avoids over-learning from one correction
- ✅ Only improves for repeated issues
- ✅ Optional manual trigger for immediate learning

**Token Budget Management:**
- Reserve tokens: Glossary > TM > References > Custom Prompt
- Truncate/prioritize if exceeding limit
- Track token usage per project

**Secondary Prompts:**
- Built-in templates for common tasks
- Custom prompt creation for project-specific needs
- Cacheable for performance

### Advanced Features (Phase 2+)

**Team Learning:**
- Shared correction history across team
- Individual translator skill tracking
- Collaborative prompt refinement

**Quality Assurance:**
- QA checks on LLM suggestions
- Automated terminology compliance
- Style guide violation detection
- Confidence thresholds (auto-accept >95%, flag <50%)

**Multi-Language Support:**
- Language-pair specific prompts
- Direction-specific rules (EN→ES vs ES→EN)
- Right-to-left language handling

**Integration with Existing Features:**
- Coexist with Google Translate/DeepL
- Compare LLM vs traditional MT
- Fallback to TM if API fails
- Integrate with QA module

**Analytics & Reporting:**
- Translation time tracking (before/after LLM)
- User acceptance rate per translator
- Cost analysis and ROI
- Quality metrics based on edits

**Performance:**
- Caching identical segments
- Batch processing optimization
- Async processing for learning updates
- Database indexing for fast lookups

### Security & Privacy

- Encrypted API keys in database
- Optional local LLM (Ollama, LLaMA)
- Data retention policies
- User consent for data usage
- Audit logs for compliance

---

## TECHNOLOGY STACK

| Component | Technology |
|-----------|-----------|
| **LLM APIs** | Claude 3.5 Sonnet + OpenAI GPT-4o |
| **Embeddings** | OpenAI text-embedding-3-small |
| **Backend** | PHP 7.4+ (Klein framework) |
| **Frontend** | React 18 |
| **Database** | MySQL 8.0+ |
| **File Processing** | Smalot/PdfParser, PHPOffice/PhpWord |
| **Queue** | ActiveMQ (existing) |
| **API Client** | GuzzleHTTP, openai-php/client |

---

## CONCLUSION

This architecture creates an intelligent, learning-aware CAT tool that:
- ✅ Leverages company glossaries and translation memory
- ✅ Learns from user corrections automatically
- ✅ Provides flexible secondary prompts for analysis
- ✅ Integrates style guides and brand guidelines
- ✅ Improves translation quality over time
- ✅ Maintains human control throughout

The phased approach allows for iterative development and user feedback integration.
