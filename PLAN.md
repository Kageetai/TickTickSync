# Plan: TickTickSync + TaskNotes-Compatible Files (Additive Mode)

## Overview

This document outlines the plan to **extend** TickTickSync so that tasks synced from TickTick create **additional TaskNotes-compatible files** alongside the existing inline task lines. This is an **additive enhancement**, not a replacement.

## Design Principle: Additive, Not Exclusive

The key insight is that TaskNotes files work **on top of** the existing behavior:

1. **Inline task lines continue to work exactly as before**
2. **When enabled**, each task also gets a dedicated task file
3. **The inline task links to the task file** via wikilink
4. **Both stay in sync** - changes to either propagate to TickTick

This approach eliminates migration complexity and maintains full backward compatibility.

---

## Current + Target Behavior

### Current TickTickSync Behavior (unchanged)
Tasks are stored as **inline markdown lines** within files:
```markdown
- [ ] Task content #ticktick 📅 2024-01-15 ⏫ %%[ticktick_id:: abc123def456]%%
  --- Notes section ---
  Note content here
  --- Notes section ---
```

### New Additive Behavior (when TaskNotes mode enabled)
The inline task **also links to a task file**:
```markdown
- [ ] [[Task content]] #ticktick 📅 2024-01-15 ⏫ %%[ticktick_id:: abc123def456]%%
```

And the task file `TaskNotes/Tasks/Task content.md` contains:
```markdown
---
tags:
  - task
title: Task content
status: open
priority: high
due: 2024-01-15
ticktick_id: abc123def456
project: "[[Project Name]]"
contexts:
  - "@context"
dateCreated: 2024-01-10T10:30:00Z
dateModified: 2024-01-15T14:22:00Z
---

Note content here (task description from TickTick)

## Checklist
- [ ] Subtask 1
- [x] Subtask 2
```

### Benefits of Additive Approach
- **No migration needed** - existing tasks keep working
- **No mode switching** - just enable the feature
- **Graceful degradation** - disable TaskNotes mode, inline tasks still work
- **Best of both worlds** - quick inline view + rich task files
- **Less error-prone** - inline tasks remain source of truth for basic sync

---

## Property Mapping: TickTick → TaskNotes

| TickTick Property | TaskNotes Frontmatter | Notes |
|-------------------|----------------------|-------|
| `id` | `ticktick_id` | 24-char hex ID for sync tracking |
| `title` | `title` | Task title |
| `status` (0/2) | `status` | `open` / `done` (configurable) |
| `priority` (0-5) | `priority` | Map to configurable values |
| `dueDate` | `due` | ISO 8601 date (YYYY-MM-DD) |
| `startDate` | `scheduled` | ISO 8601 date |
| `content` | Body content | Task description/notes |
| `tags[]` | `contexts` | TickTick tags as contexts |
| `projectId` | `project` | Wikilink to project note |
| `items[]` | Checklist in body | Convert to markdown checklist |
| `createdTime` | `dateCreated` | ISO timestamp |
| `modifiedTime` | `dateModified` | ISO timestamp |
| `timeZone` | (handled internally) | For date conversions |
| `isAllDay` | (affects date format) | Date vs DateTime |

### Priority Mapping
| TickTick Priority | TaskNotes Priority |
|-------------------|-------------------|
| 0 (None) | `none` |
| 1 (Low) | `low` |
| 3 (Medium) | `normal` |
| 5 (High) | `high` |

### Status Mapping
| TickTick Status | TaskNotes Status |
|-----------------|------------------|
| 0 (Active) | `open` |
| 2 (Completed) | `done` |

---

## Architecture Changes

### Phase 1: Core Infrastructure

#### 1.1 New Settings
**File:** `src/settings.ts`

Add new settings (simpler than before - no mode switching):
```typescript
interface TickTickSyncSettings {
  // ... existing settings ...

  // TaskNotes Enhancement
  enableTaskNotes: boolean;            // Create task files alongside inline tasks
  taskNotesFolder: string;             // Default: "TaskNotes/Tasks"
  taskNotesFileNameTemplate: string;   // Default: "{title}"
  taskNotesTagValue: string;           // Default: "task"
  linkInlineToTaskFile: boolean;       // Default: true - wrap title in [[wikilink]]

  // Field Mapping (allow customization like TaskNotes does)
  taskNotesFieldMapping: {
    status: string;      // Default: "status"
    priority: string;    // Default: "priority"
    due: string;         // Default: "due"
    scheduled: string;   // Default: "scheduled"
    project: string;     // Default: "project"
    contexts: string;    // Default: "contexts"
  };

  // Status/Priority value mappings
  taskNotesStatusValues: {
    open: string;        // Default: "open"
    done: string;        // Default: "done"
  };
  taskNotesPriorityValues: {
    none: string;        // Default: "none"
    low: string;         // Default: "low"
    normal: string;      // Default: "normal"
    high: string;        // Default: "high"
  };
}
```

#### 1.2 Task File Converter
**New File:** `src/taskNotesConverter.ts`

```typescript
class TaskNotesConverter {
  // Convert ITask to TaskNotes frontmatter + body
  convertTaskToTaskNote(task: ITask): { frontmatter: Record<string, unknown>; body: string };

  // Parse TaskNotes file to extract task data
  parseTaskNoteFile(content: string): TaskNoteData;

  // Generate safe filename from task title
  generateFileName(task: ITask): string;

  // Generate wikilink for inline task
  generateWikilink(task: ITask): string;

  // Map TickTick priority/status to TaskNotes values
  mapPriority(tickTickPriority: number): string;
  mapStatus(tickTickStatus: number): string;

  // Reverse mappings for reading task files
  reverseMapPriority(taskNotesPriority: string): number;
  reverseMapStatus(taskNotesStatus: string): number;
}
```

#### 1.3 Task File Manager
**New File:** `src/services/taskFileManager.ts`

```typescript
class TaskFileManager {
  // Create a new task file
  async createTaskFile(task: ITask): Promise<TFile>;

  // Update existing task file (preserve user content below frontmatter)
  async updateTaskFile(task: ITask, existingFile: TFile): Promise<void>;

  // Delete/trash task file
  async deleteTaskFile(taskId: string): Promise<void>;

  // Find task file by TickTick ID (search frontmatter)
  async findTaskFileById(tickTickId: string): Promise<TFile | null>;

  // Build index of all task files on startup
  async indexTaskFiles(): Promise<Map<string, TFile>>;

  // Get task file path for a task
  getTaskFilePath(task: ITask): string;
}
```

---

### Phase 2: Integration with Existing Sync

#### 2.1 Modify TaskParser
**File:** `src/taskParser.ts`

Update `convertTaskToLine()` to optionally wrap title in wikilink:

```typescript
// Before:
// - [ ] Task content #ticktick ...

// After (when enableTaskNotes && linkInlineToTaskFile):
// - [ ] [[Task content]] #ticktick ...

convertTaskToLine(task: ITask): string {
  let title = task.title;

  if (settings.enableTaskNotes && settings.linkInlineToTaskFile) {
    // Wrap title in wikilink to task file
    const taskFileName = this.taskNotesConverter.generateFileName(task);
    title = `[[${taskFileName}]]`;
  }

  // ... rest of existing logic
}
```

#### 2.2 Modify SyncMan - TickTick → Obsidian
**File:** `src/services/syncModule.ts`

Hook into existing sync to also create/update task files:

```typescript
class SyncMan {
  // Modify existing persistToFile or add post-hook
  async afterTaskSynced(task: ITask, action: 'create' | 'update' | 'delete') {
    if (!settings.enableTaskNotes) return;

    switch (action) {
      case 'create':
        await this.taskFileManager.createTaskFile(task);
        break;
      case 'update':
        const file = await this.taskFileManager.findTaskFileById(task.id);
        if (file) {
          await this.taskFileManager.updateTaskFile(task, file);
        } else {
          // Task file doesn't exist yet (maybe feature just enabled)
          await this.taskFileManager.createTaskFile(task);
        }
        break;
      case 'delete':
        await this.taskFileManager.deleteTaskFile(task.id);
        break;
    }
  }
}
```

#### 2.3 Modify SyncMan - Obsidian → TickTick
**File:** `src/services/syncModule.ts`

Watch for changes in task files and sync back:

```typescript
class SyncMan {
  // Check if task file was modified
  async syncTaskFileChanges() {
    if (!settings.enableTaskNotes) return;

    const taskFiles = await this.taskFileManager.indexTaskFiles();

    for (const [tickTickId, file] of taskFiles) {
      const taskNoteData = await this.taskFileManager.readTaskFile(file);
      const cachedTask = this.cacheOperation.getTaskById(tickTickId);

      if (this.taskFileWasModified(taskNoteData, cachedTask)) {
        // Sync changes back to TickTick
        await this.updateTickTickFromTaskFile(tickTickId, taskNoteData);
        // Also update the inline task line
        await this.updateInlineTaskFromTaskFile(tickTickId, taskNoteData);
      }
    }
  }
}
```

#### 2.4 Sync Priority (Source of Truth)

When both inline task and task file exist, we need clear rules:

| Scenario | Action |
|----------|--------|
| TickTick changed | Update both inline task AND task file |
| Inline task changed | Update TickTick (existing behavior), then update task file |
| Task file changed | Update TickTick, then update inline task |
| Both changed | Compare timestamps, newer wins (with conflict warning) |

**Recommended approach:** Use TickTick's `modifiedTime` as the canonical timestamp. Local changes update this timestamp when synced.

---

### Phase 3: File Operations

#### 3.1 Task File Creation Flow

```
TickTick Sync
    ↓
Existing inline task created/updated (unchanged)
    ↓
if (enableTaskNotes)
    ↓
TaskFileManager.createTaskFile() or updateTaskFile()
    ↓
TaskNotesConverter.convertTaskToTaskNote()
    ↓
Generate frontmatter YAML + body
    ↓
Create/update file in taskNotesFolder
    ↓
Update inline task with [[wikilink]] if needed
```

#### 3.2 File Naming Strategy

1. **Primary:** Use task title (sanitized)
   - Remove invalid characters: `/ \ : * ? " < > |`
   - Replace with safe alternatives or remove
   - Truncate to max 100 characters
   - Add numeric suffix if duplicate: `Task Name.md`, `Task Name 2.md`

2. **Fallback:** Use TickTick ID if title is empty
   - `task-abc123def456.md`

3. **Handle renames:**
   - Track files by `ticktick_id` in frontmatter, not filename
   - If title changes, consider renaming file or keeping old name
   - Setting: `renameFilesOnTitleChange: boolean`

#### 3.3 File Content Structure

```markdown
---
tags:
  - task
title: "Task title here"
status: open
priority: high
due: 2024-01-15
scheduled: 2024-01-14
ticktick_id: abc123def456789012345678
project: "[[Project Name]]"
contexts:
  - "@home"
  - "@computer"
dateCreated: 2024-01-10T10:30:00.000Z
dateModified: 2024-01-15T14:22:00.000Z
---

Task description/notes from TickTick go here.

This can be multiple paragraphs.

## Checklist
- [ ] Subtask item 1 %%item_abc123%%
- [x] Subtask item 2 %%item_def456%%
- [ ] Subtask item 3 %%item_ghi789%%

---
*Below this line: user's own notes (preserved on sync)*
```

#### 3.4 Content Preservation Strategy

When updating a task file from TickTick:
1. Parse existing file to find user-added content
2. Update frontmatter fields
3. Update TickTick description section
4. Update checklist items
5. **Preserve everything after the `---` separator**

This allows users to add their own notes to task files without losing them.

---

### Phase 4: Cache & Index

#### 4.1 Task File Index
**File:** `src/services/cacheOperation.ts`

Add tracking for task files:

```typescript
interface TaskFileIndex {
  // Map ticktick_id → file path
  byTickTickId: Map<string, string>;
  // Map file path → ticktick_id
  byFilePath: Map<string, string>;
  // Last known modification times
  modifiedTimes: Map<string, number>;
}

class CacheOperation {
  private taskFileIndex: TaskFileIndex;

  // Build index on startup
  async buildTaskFileIndex(): Promise<void>;

  // Get file path for a task
  getTaskFilePath(tickTickId: string): string | null;

  // Get ticktick_id for a file
  getTickTickIdForFile(filePath: string): string | null;

  // Update index when file created/moved/deleted
  updateTaskFileIndex(tickTickId: string, filePath: string | null): void;
}
```

#### 4.2 Efficient Frontmatter Search

To find task files by `ticktick_id`:

```typescript
async findTaskFileById(tickTickId: string): Promise<TFile | null> {
  // First check index
  const cached = this.cacheOperation.getTaskFilePath(tickTickId);
  if (cached) {
    const file = this.app.vault.getAbstractFileByPath(cached);
    if (file instanceof TFile) return file;
  }

  // Fallback: scan task files folder
  const folder = this.app.vault.getAbstractFileByPath(settings.taskNotesFolder);
  if (!folder) return null;

  for (const file of this.app.vault.getMarkdownFiles()) {
    if (!file.path.startsWith(settings.taskNotesFolder)) continue;

    const cache = this.app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.ticktick_id === tickTickId) {
      // Update index
      this.cacheOperation.updateTaskFileIndex(tickTickId, file.path);
      return file;
    }
  }

  return null;
}
```

---

### Phase 5: UI & Settings

#### 5.1 Settings Tab Addition
**File:** `src/ui/settings/`

Add new settings section:

```
## TaskNotes Integration

[x] Enable TaskNotes-compatible task files
    Create a dedicated markdown file for each task with YAML frontmatter.
    Works alongside existing inline tasks.

[x] Link inline tasks to task files
    Wrap task titles in [[wikilinks]] pointing to the task file.

### Task Files Location
[TaskNotes/Tasks    ] Browse...

### File Naming Template
[{title}            ]
    Available: {title}, {id}, {date}, {project}

### Frontmatter Field Names
(Customize to match your TaskNotes settings)

| Field      | Name       |
|------------|------------|
| Status     | [status  ] |
| Priority   | [priority] |
| Due Date   | [due     ] |
| Scheduled  | [scheduled]|
| Project    | [project ] |
| Contexts   | [contexts] |

### Status Values
Open:   [open]
Done:   [done]

### Priority Values
None:   [none  ]
Low:    [low   ]
Medium: [normal]
High:   [high  ]
```

#### 5.2 Commands

Add new commands:
- **"Sync current task file"** - Force sync the currently open task file
- **"Open task file for inline task"** - From cursor on inline task, open its task file
- **"Create task files for existing tasks"** - One-time creation for tasks that don't have files yet

---

## Implementation Order

### Step 1: Foundation
1. Add new settings to `settings.ts`
2. Create `TaskNotesConverter` class with tests
3. Create `TaskFileManager` class with tests
4. Add task file index to `CacheOperation`

### Step 2: Task File Creation (TickTick → Files)
1. Hook into existing sync to create task files after inline tasks
2. Implement `createTaskFile()` with proper YAML generation
3. Implement `updateTaskFile()` with content preservation
4. Test: Sync from TickTick creates both inline task + task file

### Step 3: Wikilink Integration
1. Modify `TaskParser.convertTaskToLine()` to add wikilinks
2. Handle wikilink in task title parsing (don't duplicate brackets)
3. Test: Inline tasks show `[[Task Title]]` linking to task file

### Step 4: Bidirectional Sync (Files → TickTick)
1. Implement task file change detection
2. Parse task file frontmatter changes
3. Update TickTick via API
4. Update inline task to match
5. Test: Edit task file → changes appear in TickTick and inline task

### Step 5: Edge Cases & Polish
1. Handle task deletion (delete/archive task file)
2. Handle title changes (rename file or not)
3. Handle file moves/renames (track by ticktick_id)
4. Add commands
5. Settings UI

### Step 6: Testing & Documentation
1. Full integration testing
2. Test with TaskNotes plugin installed
3. Update README
4. Add user documentation

---

## File Structure Changes

```
src/
├── main.ts                      # Add commands
├── settings.ts                  # Add TaskNotes settings
├── taskParser.ts                # Add wikilink wrapping
├── taskNotesConverter.ts        # NEW: Format conversion
├── fileOperation.ts             # (minimal changes)
├── services/
│   ├── index.ts                 # Initialize TaskFileManager
│   ├── syncModule.ts            # Hook task file creation into sync
│   ├── cacheOperation.ts        # Add task file index
│   └── taskFileManager.ts       # NEW: Task file CRUD
├── api/
│   └── types/
│       └── TaskNote.ts          # NEW: TaskNotes types
└── ui/
    └── settings/
        └── TaskNotesSettings.svelte  # NEW: Settings component
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| File naming collisions | Medium | Track by ticktick_id, add numeric suffix |
| Performance with many tasks | Medium | Index task files, use Obsidian metadataCache |
| Content loss on sync | High | Preserve user content below separator, backup |
| Wikilink breaks existing parsing | Medium | Careful regex updates, thorough testing |
| Out-of-sync inline vs file | Medium | Clear sync priority rules, conflict detection |

---

## Questions to Resolve

1. **Should wikilinks use full path or just filename?**
   - `[[Task Title]]` vs `[[TaskNotes/Tasks/Task Title]]`
   - **Recommendation:** Just filename (Obsidian resolves it)

2. **How to handle TickTick task items (checklist)?**
   - Store in body with item IDs: `- [ ] Item %%item_id%%`
   - Sync item completion status bidirectionally
   - **Recommendation:** Yes, include item IDs for sync

3. **What happens when user deletes the task file but not inline task?**
   - Option A: Recreate task file on next sync
   - Option B: Remove inline task too
   - **Recommendation:** Option A (recreate), with setting to change behavior

4. **Recurrence support?**
   - TickTick has recurrence, TaskNotes uses RRULE
   - **Recommendation:** Add `recurrence` field to frontmatter, format TBD

---

## Success Criteria

- [ ] Enabling TaskNotes creates task files for all synced tasks
- [ ] Inline tasks include [[wikilink]] to their task file
- [ ] Task files have correct TaskNotes-compatible frontmatter
- [ ] Editing task file syncs changes back to TickTick
- [ ] Editing task file syncs changes to inline task
- [ ] Existing inline-only users see no change (feature disabled by default)
- [ ] Task files preserve user-added content below separator
- [ ] Works correctly with TaskNotes plugin installed
