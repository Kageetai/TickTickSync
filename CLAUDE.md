# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TickTickSync is an Obsidian plugin that provides bidirectional synchronization between Obsidian tasks and TickTick. It supports two mutually exclusive sync modes:

1. **Inline Tasks Mode** (default) - Tasks use markdown checkbox format with `#ticktick` tag
2. **TaskNotes Mode** - Tasks are dedicated markdown files with YAML frontmatter

**These modes are mutually exclusive.** When TaskNotes mode is enabled (`settings.enableTaskNotes`), inline task sync is disabled and vice versa. Many methods have early-return guards checking this setting.

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

- **`src/services/cacheOperation.ts`** (`CacheOperation`) - Manages local task cache and file metadata. Tracks which tasks exist in which files. Key methods:
  - `appendTaskToCache(task, filePath)` - Add new task (requires both arguments!)
  - `updateTaskToCache(task, filePath)` - Update existing task
  - `loadTaskFromCacheID(id)` - Get task by TickTick ID
  - `updateTaskFileIndex(id, path)` - Update TaskNotes file index

- **`src/fileOperation.ts`** (`FileOperation`) - File I/O operations for reading/writing tasks to Obsidian vault files.

- **`src/services/fileMap.ts`** (`FileMap`) - Parses file content to track task records, line numbers, parent-child relationships, and task items.

- **`src/settings.ts`** - Plugin settings management with `getSettings()`/`updateSettings()` pattern. Stores in-memory settings and syncs to Obsidian's data storage.

- **`src/dateMan.ts`** (`DateMan`) - Date/time handling and conversion between Obsidian and TickTick formats.

### TaskNotes Components

- **`src/services/taskFileManager.ts`** (`TaskFileManager`) - CRUD operations for TaskNotes files. Manages file index, finds files by TickTick ID, handles file creation/updates.

- **`src/taskNotesConverter.ts`** (`TaskNotesConverter`) - Converts between TickTick ITask objects and TaskNotes file format. Generates frontmatter YAML, parses task files, extracts task data from frontmatter and body content.

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

### Inline Task Format
Tasks in Obsidian use this format:
```markdown
- [ ] Task content #ticktick 📅 2024-01-15 ⏫ %%[ticktick_id:: abc123def456]%%
```
- `#ticktick` tag triggers sync
- Priority emojis: ⏬🔽🔼⏫🔺
- Due date: 📅 or 🗓️ emoji followed by YYYY-MM-DD
- Task ID stored in `%%[ticktick_id:: <24-char-hex>]%%`

### TaskNotes File Format
TaskNotes are markdown files with YAML frontmatter:
```markdown
---
ticktick_id: abc123def456789012345678
status: open
priority: high
due: 2024-01-15
project: Work
tags:
  - task
---

Task description and notes here.

## Checklist
- [ ] Subtask 1
- [x] Subtask 2
```

Key points:
- `ticktick_id` links the file to a TickTick task
- Description content goes directly after frontmatter (no heading)
- `## Checklist` section only appears when task has checklist items
- Existing frontmatter fields (e.g., `created`, `changed`) are preserved during sync

### Path Aliases
The project uses `@/` as a path alias to `./src/` (configured in tsconfig.json).

### State Management
- Settings use a simple store pattern in `src/store.ts`
- Svelte components use `settingsStore` from `src/ui/settings/settingsstore.ts`

### Sync Flow (Inline Tasks Mode)
1. `TickTickService.synchronization()` acquires lock
2. `SyncMan.syncTickTickToObsidian()` fetches remote tasks, compares with cache
3. New/updated tasks are written to vault files
4. `syncFiles()` scans tracked files for local changes to upload

### Sync Flow (TaskNotes Mode)
1. `TickTickService.synchronization()` acquires lock
2. `SyncMan.syncTickTickToObsidian()` fetches remote tasks, creates/updates TaskNotes files
3. `syncTaskFileChangesToTickTick()` scans TaskNotes folder for modified files
4. Modified files are parsed and changes sent to TickTick API

Commands in TaskNotes mode:
- **"Sync current task file to TickTick"** - Syncs the active file directly
  - If file has no `ticktick_id`: calls `createTaskFromTaskFile()` to create new task
  - If file has `ticktick_id`: calls `updateTaskFromTaskFile()` to update existing task

### TickTick API Notes

**Important:** TickTick uses both `content` and `desc` fields for task body:
- `content` - Appears in the task body in TickTick UI
- `desc` - Also stores description but may not display in all views

When creating/updating tasks, always set BOTH fields to ensure content appears correctly:
```typescript
const task = {
    title: "Task title",
    content: description,  // Required for TickTick UI
    desc: description,     // Also set for completeness
    // ...
};
```

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
