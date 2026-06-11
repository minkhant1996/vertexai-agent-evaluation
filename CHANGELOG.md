# Changelog

All notable changes to this project will be documented in this file.

## [2.3.0] - 2024-06-08

### Added
- **Quality Flywheel Integration**: Google's 5-step agent optimization workflow
  - Scenario generation via User Simulation
  - Inference execution with traces
  - Multi-turn AutoRaters (MULTI_TURN_TASK_SUCCESS, TOOL_USE_QUALITY, TRAJECTORY_QUALITY)
  - Loss cluster analysis (Auto-Loss Analysis)
  - LLM-assisted instruction optimization (GEPA scaffold; Gemini rewrite today)
- **Real A/B Testing**: Replaced mock testing with actual Gemini-based evaluation
  - Per-scenario score comparison
  - Side-by-side response previews
  - Detailed winner determination
- **Python Scripts**: New optimization scripts
  - `scripts/vertex_evaluation.py` - Quality Flywheel implementation
  - `scripts/adk_optimizer.py` - Google ADK optimizer
- **Documentation**: Comprehensive docs in `/docs/`
  - `QUICKSTART.md` - Getting started guide
  - `OPTIMIZER_SYSTEM.md` - Full architecture
  - `API_REFERENCE.md` - API endpoints

### Changed
- **OptimizerDashboard.jsx**: Added method selector, side-by-side A/B results UI
- **optimizer.ts**: Added `runQualityFlywheel()`, fixed `runABTest()` to actually test instructions
- **track2-api.ts**: Added scenario details in A/B test response
- **README.md**: Updated with new features and architecture
- **.gitignore**: Added storage files, credentials, build outputs

### Fixed
- A/B test now actually evaluates both instructions (was running same agent twice)
- Version apply now uses full instruction (was using only fix snippet)
- Version numbering no longer skips numbers

## [2.2.0] - 2024-06-07

### Added
- Version details popup modal
- A/B test version selector modal
- Agent selector dropdown for optimization target
- Corruption protection for short instructions

### Changed
- Updated `applyPatternFix()` to return full instruction
- Improved version history tracking

## [2.1.0] - 2024-06-06

### Added
- Basic A/B testing UI
- Instruction version management
- Pattern-based fix generation

### Changed
- Refactored optimizer to support multiple methods

## [2.0.0] - 2024-06-01

### Added
- Track 2 Optimizer Dashboard
- Agent Simulation with 20 edge cases
- Observability and tracing
- Dynamic prompt templates

## [1.0.0] - 2024-05-15

### Added
- Initial multi-agent system
- Orchestrator with 4 sub-agents
- Validation tools
- Basic chat UI
