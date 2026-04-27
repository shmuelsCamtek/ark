# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Project Overview

**Ark Story Studio** — a web app where non-technical org experts (PMs, support leads, ops) turn business problems into well-formed Azure DevOps user stories, guided by an AI "coach" that reads their backlog and suggests personas, copy, and acceptance criteria.

## Build & Run
*** need to deside  ***

No test framework is configured yet.

## Environment Constraints

*** need to deside  ***

## Tech Stack

*** need to deside  ***

## Architecture

```
src/
├── fe/                     # Front end code
├── backend/                # backend code
```

**Key patterns:**
*** need to deside  ***

## Design Reference

Full design handoff lives in `docs/design_handoff_ark_story_studio/`. Key files:
*** need to deside  ***

**Brand:** 
*** need to deside  ***

## Implementation Status

*** need to deside  ***

## Behavioral Guidelines

- **Simplicity first:** minimum code that solves the problem, no speculative features or abstractions.
- **Surgical changes:** touch only what's needed, match existing style, don't "improve" adjacent code.
- **Ask before assuming:** if multiple interpretations exist, present them. If unclear, stop and ask.
- **Goal-driven:** define success criteria before implementing. For multi-step tasks, state a brief plan with verification steps.
