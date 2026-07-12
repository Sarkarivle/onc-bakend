# Jobo AI Prompt Architecture (Gemini Pro Level)

This directory contains the modular prompt system for Jobo AI. It is designed for scalability and high-precision reasoning.

## Directory Structure

- `persona.js`: The main assembler that imports components and builds the final System Prompt.
- `index.js`: Handles Mode/Intent-based capability prompts.
- `formatting.js`: Legacy formatting rules (to be merged).
- `components/`: **The core parts of the Persona.**
    - `identity.js`: Defines Jobo's "Bada Bhai" personality.
    - `grounding_verification.js`: Ensures zero-hallucination by trusting tool data.
    - `mentor_standards.js`: Defines the 7-step response quality.
    - `formatting_rules.js`: Controls the visual output (No code blocks, Hinglish).
    - `self_correction.js`: AI's internal check-loop before responding.
    - `greeting.js`: Specialized persona for simple "Hello/Hi".

## How to use
When adding a new behavioral rule to the Persona, do NOT edit `persona.js` directly. Instead, create or update a file in the `components/` directory.

## Architecture Version: 14.0 (Modular)
Designed to handle 1M+ users with low token overhead.
