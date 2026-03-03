# Community Signal: Exploratory Discourse Layer

This document outlines the design for the "Community Signal" feature—a non-deterministic, exploratory layer that aggregates independent claims and user discourse to provide buyers with "soft" technical context.

## Core Mandate
> "This section reflects aggregated community discourse and does not influence the Truth Index."

## Extraction Goals (NotebookLM Style)
The goal is to move beyond "Verified Specs" into "Discovered Constraints."

### 1. Technical Constraints (The "Soft" Spec)
*   **Voltage Windows:** Identify "Low-Voltage Disconnect" points (e.g., car charging cutoffs at 10.5V) or strict Solar/PV range warnings.
*   **Expansion Mapping:** Specific notes on battery expansion cable quirks or daisy-chaining limits.

### 2. Operational Signals
*   **UPS/EPS Performance:** Aggregated complaints or praise regarding switchover times (ms) or failure to trigger with specific PC power supplies.
*   **Noise Profiles:** Community reports on fan curve behavior (e.g., "Always on during solar charging" or "Silent under 500W").

### 3. Long-Term Reliability
*   **Degradation:** Early reports of capacity fade or BMS calibration issues (e.g., "Drops from 20% to 0% suddenly").

## Data Schema (Proposed)
```typescript
interface CommunitySignal {
  last_updated: string;
  signals: {
    voltage_window_notes?: string[];
    ups_performance_notes?: string[];
    expansion_compatibility_notes?: string[];
    noise_and_thermal_notes?: string[];
    long_term_degradation_notes?: string[];
  };
  discourse_metrics: {
    most_discussed_constraints: string[];
    most_cited_complaints: string[];
    most_praised_attributes: string[];
    common_confusion_areas: string[];
  };
}
```

## Differentiation from Stage 2 Audit
| Feature | Stage 2/3 (Scoring) | Community Signal (Non-Scoring) |
| :--- | :--- | :--- |
| **Method** | Deterministic Extraction | Exploratory Aggregation |
| **Validation** | Schema-bound / Range-checked | Best-effort / Discourse-based |
| **Source Type** | Official Docs / Retailer Data | Reddit, YT Reviews, Forums |
| **Impact** | Influences Truth Index | UI "Fyi" signal only |

## UI Delivery Concept
A secondary tab or a sidebar card titled **"Community Signal: Exploratory Layer"** with the explicit non-scoring disclaimer.
