---
name: code-style
description: Generate TypeScript code with specific style constraints. Use when writing TypeScript code for this project to ensure consistency and quality.
allowed-tools: Read, Edit, Write, Bash
---

# Code Style Guidelines

## Core Principles

1. **Minimal Implementation**
   - Only implement basic functionality, no redundant features
   - Do not add defensive code for impossible scenarios
   - Do not add configuration options or feature flags unless explicitly requested
   - Delete unused code immediately, do not keep "might be useful later" code

2. **TypeScript Requirements**
   - Use TypeScript for all code
   - Enable strict mode (strict: true)
   - Use explicit type declarations, avoid `any`
   - Interface naming should be clear and descriptive

3. **Modular Design**
   - Single Responsibility Principle: each module does one thing
   - Layer by functionality:
     - `config/` - Configuration related
     - `services/` - Business logic services
     - `utils/` - Utility functions
     - `types/` - Type definitions
   - Use dependency injection instead of global state
   - Communicate between modules through interfaces, reduce coupling

4. **Code Readability**
   - Function naming: verb + noun, e.g., `parseMessage`, `encryptData`
   - Variable naming should clearly express purpose, avoid abbreviations
   - Keep functions under 50 lines, split if exceeded
   - Use early returns to reduce nesting levels
   - Add brief comments for complex logic explaining "why"

5. **Maintainability**
   - Separate configuration from code, use environment variables
   - Centralize error handling, don't scatter it everywhere
   - Log key paths for troubleshooting
   - Avoid magic numbers, use named constants

6. **Async Handling**
   - Use async/await, avoid callback hell
   - Handle Promise errors uniformly
   - Use AbortController for timeout control

## Project Structure Template

```
src/
├── config/
│   └── index.ts          # Configuration loading and validation
├── types/
│   └── index.ts          # All type definitions
├── services/
│   ├── wecom-crypt.ts    # WeCom encryption/decryption
│   ├── wecom-api.ts      # WeCom API calls
│   └── openclaw.ts       # OpenClaw integration
├── utils/
│   └── xml-parser.ts     # XML parsing utilities
└── server.ts             # Entry point
```

## Before Writing Code

1. Check if existing files can be modified rather than creating new ones
2. Understand existing patterns in the codebase
3. Ensure type safety with explicit interfaces
4. Avoid over-engineering - simplest solution is best
