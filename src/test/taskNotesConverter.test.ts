import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskNotesConverter } from '../taskNotesConverter';
import type { ITask } from '@/api/types/Task';
import * as settings from '@/settings';

// Mock the settings module
vi.mock('@/settings', () => ({
	getSettings: vi.fn(() => ({
		taskNotesFolder: 'TaskNotes/Tasks',
		taskNotesFileNameTemplate: '{title}',
		taskNotesTagValue: 'task',
		taskNotesFieldMapping: {
			status: 'status',
			priority: 'priority',
			due: 'due',
			scheduled: 'scheduled',
			project: 'project',
			contexts: 'contexts'
		},
		taskNotesStatusValues: {
			open: 'open',
			done: 'done'
		},
		taskNotesPriorityValues: {
			none: 'none',
			low: 'low',
			normal: 'normal',
			high: 'high'
		},
		TickTickTasksData: {
			projects: [
				{ id: 'proj123', name: 'Work Project' },
				{ id: 'proj456', name: 'Personal' }
			]
		}
	}))
}));

// Create converter instance without app/plugin dependencies for unit tests
// @ts-ignore - we're intentionally passing null for unit tests
const converter = new TaskNotesConverter(null, null);

describe('TaskNotesConverter', () => {
	describe('mapPriority', () => {
		it('should map TickTick priority 5 to high', () => {
			expect(converter.mapPriority(5)).toBe('high');
		});

		it('should map TickTick priority 3 to normal', () => {
			expect(converter.mapPriority(3)).toBe('normal');
		});

		it('should map TickTick priority 1 to low', () => {
			expect(converter.mapPriority(1)).toBe('low');
		});

		it('should map TickTick priority 0 to none', () => {
			expect(converter.mapPriority(0)).toBe('none');
		});
	});

	describe('mapStatus', () => {
		it('should map TickTick status 0 (active) to open', () => {
			expect(converter.mapStatus(0)).toBe('open');
		});

		it('should map TickTick status 2 (completed) to done', () => {
			expect(converter.mapStatus(2)).toBe('done');
		});

		it('should map any positive status to done', () => {
			expect(converter.mapStatus(1)).toBe('done');
			expect(converter.mapStatus(5)).toBe('done');
		});
	});

	describe('reverseMapPriority', () => {
		it('should reverse map high to 5', () => {
			expect(converter.reverseMapPriority('high')).toBe(5);
		});

		it('should reverse map normal to 3', () => {
			expect(converter.reverseMapPriority('normal')).toBe(3);
		});

		it('should reverse map low to 1', () => {
			expect(converter.reverseMapPriority('low')).toBe(1);
		});

		it('should reverse map none to 0', () => {
			expect(converter.reverseMapPriority('none')).toBe(0);
		});

		it('should default to 0 for unknown values', () => {
			expect(converter.reverseMapPriority('unknown')).toBe(0);
		});
	});

	describe('reverseMapStatus', () => {
		it('should reverse map done to 2', () => {
			expect(converter.reverseMapStatus('done')).toBe(2);
		});

		it('should reverse map open to 0', () => {
			expect(converter.reverseMapStatus('open')).toBe(0);
		});

		it('should default to 0 for unknown values', () => {
			expect(converter.reverseMapStatus('unknown')).toBe(0);
		});
	});

	describe('generateFileName', () => {
		it('should generate filename from task title', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'My Test Task'
			};
			expect(converter.generateFileName(task as ITask)).toBe('My Test Task');
		});

		it('should sanitize invalid characters', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'Task: with/invalid*chars?'
			};
			// Invalid chars are removed (not replaced with spaces)
			expect(converter.generateFileName(task as ITask)).toBe('Task withinvalidchars');
		});

		it('should truncate long titles', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'A'.repeat(150) // 150 characters
			};
			const fileName = converter.generateFileName(task as ITask);
			expect(fileName.length).toBeLessThanOrEqual(100);
		});

		it('should fallback to task ID if title is empty', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: ''
			};
			expect(converter.generateFileName(task as ITask)).toBe('task-abc123def456789012345678');
		});
	});

	describe('generateWikilink', () => {
		it('should generate wikilink from task', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'My Task'
			};
			expect(converter.generateWikilink(task as ITask)).toBe('[[My Task]]');
		});
	});

	describe('convertTaskToTaskNote', () => {
		it('should convert a basic task to TaskNote format', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'Test Task',
				status: 0,
				priority: 3,
				projectId: 'proj123',
				createdTime: '2024-01-10T10:30:00Z',
				modifiedTime: '2024-01-15T14:22:00Z'
			};

			const result = converter.convertTaskToTaskNote(task as ITask);

			expect(result.frontmatter.title).toBe('Test Task');
			expect(result.frontmatter.status).toBe('open');
			expect(result.frontmatter.priority).toBe('normal');
			expect(result.frontmatter.ticktick_id).toBe('abc123def456789012345678');
			expect(result.frontmatter.project).toBe('[[Work Project]]');
			expect(result.frontmatter.tags).toContain('task');
		});

		it('should include due date when present', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'Task with due date',
				status: 0,
				priority: 0,
				dueDate: '2024-01-15T00:00:00Z',
				isAllDay: true
			};

			const result = converter.convertTaskToTaskNote(task as ITask);

			expect(result.frontmatter.due).toBe('2024-01-15');
		});

		it('should include scheduled date when present', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'Scheduled task',
				status: 0,
				priority: 0,
				startDate: '2024-01-14T09:00:00Z',
				isAllDay: false
			};

			const result = converter.convertTaskToTaskNote(task as ITask);

			expect(result.frontmatter.scheduled).toBe('2024-01-14T09:00');
		});

		it('should convert tags to contexts', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'Tagged task',
				status: 0,
				priority: 0,
				tags: ['work', 'urgent', 'ticktick']
			};

			const result = converter.convertTaskToTaskNote(task as ITask);

			expect(result.frontmatter.contexts).toEqual(['@work', '@urgent']);
			// ticktick tag should be filtered out
			expect(result.frontmatter.contexts).not.toContain('@ticktick');
		});

		it('should include checklist items in body', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'Task with items',
				status: 0,
				priority: 0,
				items: [
					{ id: 'item1', title: 'First item', status: 0 },
					{ id: 'item2', title: 'Done item', status: 2 }
				]
			};

			const result = converter.convertTaskToTaskNote(task as ITask);

			expect(result.body).toContain('## Checklist');
			expect(result.body).toContain('- [ ] First item %%item1%%');
			expect(result.body).toContain('- [x] Done item %%item2%%');
		});
	});

	describe('parseTaskNoteFile', () => {
		it('should parse a TaskNote file with frontmatter', () => {
			const content = `---
title: Test Task
status: open
priority: high
ticktick_id: abc123
---

Some description here.`;

			const result = converter.parseTaskNoteFile(content);

			expect(result.frontmatter.title).toBe('Test Task');
			expect(result.frontmatter.status).toBe('open');
			expect(result.frontmatter.priority).toBe('high');
			expect(result.frontmatter.ticktick_id).toBe('abc123');
			expect(result.body).toContain('Some description here.');
		});

		it('should parse array values in frontmatter', () => {
			const content = `---
tags:
  - task
  - important
contexts:
  - @work
  - @home
---

Body content`;

			const result = converter.parseTaskNoteFile(content);

			expect(result.frontmatter.tags).toEqual(['task', 'important']);
			expect(result.frontmatter.contexts).toEqual(['@work', '@home']);
		});

		it('should detect user content after separator', () => {
			const content = `---
title: Test
---

Description

---
User's own notes here`;

			const result = converter.parseTaskNoteFile(content);

			expect(result.userContent).toBe("User's own notes here");
		});

		it('should handle content without frontmatter', () => {
			const content = 'Just plain text without frontmatter';

			const result = converter.parseTaskNoteFile(content);

			expect(result.frontmatter).toEqual({});
			expect(result.body).toBe(content);
		});
	});

	describe('extractTaskData', () => {
		it('should extract task data from parsed TaskNote', () => {
			const taskNoteData = {
				frontmatter: {
					title: 'Extracted Task',
					status: 'done',
					priority: 'high',
					ticktick_id: 'xyz789',
					due: '2024-02-01',
					contexts: ['@work', '@urgent']
				},
				// IDs must be hex-only (a-f0-9) to match the regex
				body: '## Checklist\n- [x] Item 1 %%abc123%%\n- [ ] Item 2 %%def456%%'
			};

			const result = converter.extractTaskData(taskNoteData);

			expect(result.id).toBe('xyz789');
			expect(result.title).toBe('Extracted Task');
			expect(result.status).toBe(2);
			expect(result.priority).toBe(5);
			expect(result.dueDate).toBe('2024-02-01');
			expect(result.tags).toEqual(['work', 'urgent']);
			expect(result.items).toHaveLength(2);
			expect(result.items?.[0].status).toBe(2);
			expect(result.items?.[1].status).toBe(0);
		});
	});

	describe('generateFrontmatterYaml', () => {
		it('should generate valid YAML from frontmatter object', () => {
			const frontmatter = {
				title: 'Test',
				status: 'open',
				tags: ['task', 'test']
			};

			const yaml = converter.generateFrontmatterYaml(frontmatter);

			expect(yaml).toContain('---');
			expect(yaml).toContain('title: Test');
			expect(yaml).toContain('status: open');
			expect(yaml).toContain('tags:');
			expect(yaml).toContain('  - task');
			expect(yaml).toContain('  - test');
		});

		it('should quote special characters', () => {
			const frontmatter = {
				project: '[[Work Project]]',
				contexts: ['@home']
			};

			const yaml = converter.generateFrontmatterYaml(frontmatter);

			expect(yaml).toContain('"[[Work Project]]"');
			expect(yaml).toContain('"@home"');
		});
	});

	describe('generateTaskFileContent', () => {
		it('should generate complete task file content', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'Complete Task',
				status: 0,
				priority: 5,
				content: 'This is the task description.'
			};

			const content = converter.generateTaskFileContent(task as ITask);

			expect(content).toContain('---');
			expect(content).toContain('title: Complete Task');
			expect(content).toContain('status: open');
			expect(content).toContain('priority: high');
			expect(content).toContain('This is the task description.');
		});

		it('should preserve user content when provided', () => {
			const task: Partial<ITask> = {
				id: 'abc123def456789012345678',
				title: 'Task',
				status: 0,
				priority: 0
			};

			const content = converter.generateTaskFileContent(task as ITask, 'My custom notes');

			expect(content).toContain('---\nMy custom notes');
		});
	});
});
