# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TickTickSync is an Obsidian plugin that provides bidirectional synchronization between Obsidian tasks and TickTick. It parses markdown tasks with a `#ticktick` tag and syncs them with the TickTick API.

## Development Commands

```bash
# Build for production
npm run build

# Development build with watch mode (outputs to ../test-vault/.obsidian/plugins/tickticksync)
npm run dev

# Type checking without emit
npm run check

# Run tests
npm run test

# Run a specific test file
npx vitest run src/test/taskParser.test.ts

# Run tests in watch mode
npx vitest
```

## Architecture

### Core Components

- **`src/main.ts`** - Plugin entry point (`TickTickSync` class extends Obsidian's `Plugin`). Handles lifecycle, event registration, commands, and status bar.

- **`src/services/index.ts`** (`TickTickService`) - Central service orchestrating sync operations. Initializes API, cache, and file operations. Uses locking mechanism (`doWithLock`) to prevent concurrent task operations.

- **`src/services/syncModule.ts`** (`SyncMan`) - Core sync logic. Handles task CRUD, detection of modified/deleted tasks, and bidirectional sync between TickTick and Obsidian files.

- **`src/api/index.ts`** (`Tick`) - TickTick REST API client. Handles authentication, task CRUD, project operations, and checkpoint-based incremental sync.

- **`src/taskParser.ts`** (`TaskParser`) - Converts between Obsidian markdown task format and TickTick task objects. Handles emoji-based priorities, dates, tags, and task IDs (`%%[ticktick_id:: <id>]%%`).

- **`src/services/cacheOperation.ts`** (`CacheOperation`) - Manages local task cache and file metadata. Tracks which tasks exist in which files.

- **`src/fileOperation.ts`** (`FileOperation`) - File I/O operations for reading/writing tasks to Obsidian vault files.

- **`src/services/fileMap.ts`** (`FileMap`) - Parses file content to track task records, line numbers, parent-child relationships, and task items.

- **`src/settings.ts`** - Plugin settings management with `getSettings()`/`updateSettings()` pattern. Stores in-memory settings and syncs to Obsidian's data storage.

- **`src/dateMan.ts`** (`DateMan`) - Date/time handling and conversion between Obsidian and TickTick formats.

### UI Components

- **`src/ui/settings/`** - Settings tab built with Svelte 5 components
- **`src/query/`** - Embedded TickTick query blocks for displaying tasks in notes
- **`src/modals/`** - Various modal dialogs (task deletion confirmation, default project selection, etc.)

### API Types

Located in `src/api/types/`:
- `Task.ts` - ITask interface
- `Project.ts` - IProject interface
- `Tag.ts`, `Filter.ts`, `Habit.ts` - Other TickTick entity types

## Key Patterns

### Task Format
Tasks in Obsidian use this format:
```markdown
- [ ] Task content #ticktick 📅 2024-01-15 ⏫ %%[ticktick_id:: abc123def456]%%
```
- `#ticktick` tag triggers sync
- Priority emojis: ⏬🔽🔼⏫🔺
- Due date: 📅 or 🗓️ emoji followed by YYYY-MM-DD
- Task ID stored in `%%[ticktick_id:: <24-char-hex>]%%`

### Path Aliases
The project uses `@/` as a path alias to `./src/` (configured in tsconfig.json).

### State Management
- Settings use a simple store pattern in `src/store.ts`
- Svelte components use `settingsStore` from `src/ui/settings/settingsstore.ts`

### Sync Flow
1. `TickTickService.synchronization()` acquires lock
2. `SyncMan.syncTickTickToObsidian()` fetches remote tasks, compares with cache
3. New/updated tasks are written to vault files
4. `syncFiles()` scans tracked files for local changes to upload

## Testing

Tests use Vitest with jsdom environment. Mock Obsidian API is in `src/test/AppPluginDefinitions.ts`.

```bash
# Run all tests
npm run test

# Run specific test
npx vitest run src/query/parser.test.ts
```

## Build Output

- Production build outputs `main.js` and `styles.css` to project root
- Development build outputs to `../test-vault/.obsidian/plugins/tickticksync/`
