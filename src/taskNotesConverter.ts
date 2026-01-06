import type { App } from 'obsidian';
import type TickTickSync from '@/main';
import type { ITask, ITaskItem } from '@/api/types/Task';
import { getSettings } from '@/settings';
import log from 'loglevel';

/**
 * Data structure representing a TaskNotes file content
 */
export interface TaskNoteData {
	frontmatter: Record<string, unknown>;
	body: string;
	userContent?: string; // Content added by user below separator
}

/**
 * TaskNotesConverter handles conversion between TickTick tasks and TaskNotes-compatible
 * markdown files with YAML frontmatter.
 */
export class TaskNotesConverter {
	app: App;
	plugin: TickTickSync;

	// Characters that are invalid in filenames
	private static readonly INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/g;
	private static readonly MAX_FILENAME_LENGTH = 100;

	constructor(app: App, plugin: TickTickSync) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * Convert a TickTick task to TaskNotes frontmatter and body content
	 */
	convertTaskToTaskNote(task: ITask): TaskNoteData {
		const settings = getSettings();
		const fieldMapping = settings.taskNotesFieldMapping;

		// Build frontmatter object
		const frontmatter: Record<string, unknown> = {
			tags: [settings.taskNotesTagValue],
			title: task.title?.trim() || '',
			[fieldMapping.status]: this.mapStatus(task.status),
			[fieldMapping.priority]: this.mapPriority(task.priority),
			ticktick_id: task.id
		};

		// Add due date if present
		if (task.dueDate) {
			const dueDate = this.formatDateForFrontmatter(task.dueDate, task.isAllDay);
			if (dueDate) {
				frontmatter[fieldMapping.due] = dueDate;
			}
		}

		// Add scheduled/start date if present
		if (task.startDate) {
			const scheduledDate = this.formatDateForFrontmatter(task.startDate, task.isAllDay);
			if (scheduledDate) {
				frontmatter[fieldMapping.scheduled] = scheduledDate;
			}
		}

		// Add project as wikilink if we can resolve the name
		if (task.projectId) {
			const projectName = this.getProjectName(task.projectId);
			if (projectName) {
				frontmatter[fieldMapping.project] = `[[${projectName}]]`;
			}
		}

		// Add tags/contexts (TickTick tags become TaskNotes contexts)
		if (task.tags && task.tags.length > 0) {
			// Filter out the ticktick tag and format as contexts
			const contexts = task.tags
				.filter(tag => tag.toLowerCase() !== 'ticktick')
				.map(tag => `@${tag.replace(/-/g, '_')}`);
			if (contexts.length > 0) {
				frontmatter[fieldMapping.contexts] = contexts;
			}
		}

		// Add timestamps
		if (task.createdTime) {
			frontmatter.dateCreated = task.createdTime;
		}
		if (task.modifiedTime) {
			frontmatter.dateModified = task.modifiedTime;
		}

		// Build body content
		let body = '';

		// Add notes (task.desc is the TickTick "description", task.content is legacy)
		const notesContent = task.desc || task.content || '';
		if (notesContent.length > 0) {
			const cleanNotes = this.cleanDescriptionForTaskNote(notesContent);
			if (cleanNotes) {
				body += '## Notes\n' + cleanNotes + '\n';
			}
		}

		// Add checklist items if present
		if (task.items && task.items.length > 0) {
			if (body) body += '\n';
			body += '## Checklist\n';
			for (const item of task.items) {
				const checkbox = item.status > 0 ? '[x]' : '[ ]';
				body += `- ${checkbox} ${item.title} %%${item.id}%%\n`;
			}
		}

		return { frontmatter, body: body.trim() };
	}

	/**
	 * Parse a TaskNotes file content and extract task data
	 */
	parseTaskNoteFile(content: string): TaskNoteData {
		const settings = getSettings();
		const fieldMapping = settings.taskNotesFieldMapping;
		const statusValues = settings.taskNotesStatusValues;
		const priorityValues = settings.taskNotesPriorityValues;

		// Split frontmatter and body
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
		if (!frontmatterMatch) {
			return { frontmatter: {}, body: content };
		}

		const frontmatterStr = frontmatterMatch[1];
		const body = frontmatterMatch[2] || '';

		// Parse YAML frontmatter (simple parser)
		const frontmatter = this.parseYamlFrontmatter(frontmatterStr);

		// Look for user content separator
		const separatorIndex = body.indexOf('\n---\n');
		let userContent: string | undefined;
		if (separatorIndex !== -1) {
			userContent = body.substring(separatorIndex + 5).trim();
		}

		return { frontmatter, body, userContent };
	}

	/**
	 * Extract ITask-compatible data from parsed TaskNote
	 */
	extractTaskData(taskNoteData: TaskNoteData): Partial<ITask> {
		const settings = getSettings();
		const fieldMapping = settings.taskNotesFieldMapping;
		const fm = taskNoteData.frontmatter;

		const task: Partial<ITask> = {};

		// Extract ticktick_id
		if (fm.ticktick_id) {
			task.id = String(fm.ticktick_id);
		}

		// Extract title
		if (fm.title) {
			task.title = String(fm.title);
		}

		// Extract status
		const statusValue = fm[fieldMapping.status];
		if (statusValue !== undefined) {
			task.status = this.reverseMapStatus(String(statusValue));
		}

		// Extract priority
		const priorityValue = fm[fieldMapping.priority];
		if (priorityValue !== undefined) {
			task.priority = this.reverseMapPriority(String(priorityValue));
		}

		// Extract due date
		const dueValue = fm[fieldMapping.due];
		if (dueValue) {
			task.dueDate = this.parseDateFromFrontmatter(String(dueValue));
		}

		// Extract scheduled date
		const scheduledValue = fm[fieldMapping.scheduled];
		if (scheduledValue) {
			task.startDate = this.parseDateFromFrontmatter(String(scheduledValue));
		}

		// Extract tags/contexts
		const contextsValue = fm[fieldMapping.contexts];
		if (Array.isArray(contextsValue)) {
			task.tags = contextsValue.map(ctx =>
				String(ctx).replace(/^@/, '').replace(/_/g, '-')
			);
		}

		// Extract checklist items from body
		task.items = this.extractChecklistItems(taskNoteData.body);

		// Extract notes from body (stored in task.desc for TickTick)
		const notes = this.extractNotesFromBody(taskNoteData.body);
		if (notes) {
			task.desc = notes;
		}

		return task;
	}

	/**
	 * Generate a safe filename from task
	 */
	generateFileName(task: ITask): string {
		const settings = getSettings();
		const template = settings.taskNotesFileNameTemplate;

		let fileName = template;

		// Replace template variables
		fileName = fileName.replace('{title}', task.title?.trim() || '');
		fileName = fileName.replace('{id}', task.id?.substring(0, 8) || '');

		if (task.dueDate) {
			const dateMatch = task.dueDate.match(/(\d{4}-\d{2}-\d{2})/);
			fileName = fileName.replace('{date}', dateMatch ? dateMatch[1] : '');
		} else {
			fileName = fileName.replace('{date}', '');
		}

		if (task.projectId) {
			const projectName = this.getProjectName(task.projectId);
			fileName = fileName.replace('{project}', projectName || '');
		} else {
			fileName = fileName.replace('{project}', '');
		}

		// Sanitize filename
		fileName = this.sanitizeFileName(fileName);

		// Fallback to task ID if empty
		if (!fileName) {
			fileName = `task-${task.id}`;
		}

		return fileName;
	}

	/**
	 * Generate wikilink text for inline task
	 */
	generateWikilink(task: ITask): string {
		const fileName = this.generateFileName(task);
		return `[[${fileName}]]`;
	}

	/**
	 * Map TickTick priority (0-5) to TaskNotes priority value
	 */
	mapPriority(tickTickPriority: number): string {
		const priorityValues = getSettings().taskNotesPriorityValues;

		switch (tickTickPriority) {
			case 5:
				return priorityValues.high;
			case 3:
				return priorityValues.normal;
			case 1:
				return priorityValues.low;
			case 0:
			default:
				return priorityValues.none;
		}
	}

	/**
	 * Map TickTick status (0/2) to TaskNotes status value
	 */
	mapStatus(tickTickStatus: number): string {
		const statusValues = getSettings().taskNotesStatusValues;
		return tickTickStatus > 0 ? statusValues.done : statusValues.open;
	}

	/**
	 * Reverse map TaskNotes priority to TickTick priority
	 */
	reverseMapPriority(taskNotesPriority: string): number {
		const priorityValues = getSettings().taskNotesPriorityValues;

		if (taskNotesPriority === priorityValues.high) return 5;
		if (taskNotesPriority === priorityValues.normal) return 3;
		if (taskNotesPriority === priorityValues.low) return 1;
		return 0; // none
	}

	/**
	 * Reverse map TaskNotes status to TickTick status
	 */
	reverseMapStatus(taskNotesStatus: string): number {
		const statusValues = getSettings().taskNotesStatusValues;
		return taskNotesStatus === statusValues.done ? 2 : 0;
	}

	/**
	 * Generate YAML frontmatter string from object
	 */
	generateFrontmatterYaml(frontmatter: Record<string, unknown>): string {
		const lines: string[] = ['---'];

		for (const [key, value] of Object.entries(frontmatter)) {
			if (value === undefined || value === null) continue;

			if (Array.isArray(value)) {
				lines.push(`${key}:`);
				for (const item of value) {
					lines.push(`  - ${this.yamlValue(item)}`);
				}
			} else {
				lines.push(`${key}: ${this.yamlValue(value)}`);
			}
		}

		lines.push('---');
		return lines.join('\n');
	}

	/**
	 * Generate complete task file content
	 */
	generateTaskFileContent(task: ITask, existingUserContent?: string): string {
		const taskNote = this.convertTaskToTaskNote(task);

		let content = this.generateFrontmatterYaml(taskNote.frontmatter);
		content += '\n';

		if (taskNote.body) {
			content += '\n' + taskNote.body;
		}

		// Preserve user content if any
		if (existingUserContent) {
			content += '\n\n---\n' + existingUserContent;
		}

		return content;
	}

	// ---- Private helper methods ----

	private sanitizeFileName(fileName: string): string {
		// Remove invalid characters
		let sanitized = fileName.replace(TaskNotesConverter.INVALID_FILENAME_CHARS, '');

		// Remove leading/trailing whitespace and dots
		sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

		// Truncate to max length
		if (sanitized.length > TaskNotesConverter.MAX_FILENAME_LENGTH) {
			sanitized = sanitized.substring(0, TaskNotesConverter.MAX_FILENAME_LENGTH);
		}

		return sanitized;
	}

	private getProjectName(projectId: string): string | null {
		const projects = getSettings().TickTickTasksData.projects;
		const project = projects.find(p => p.id === projectId);
		return project?.name || null;
	}

	private formatDateForFrontmatter(dateStr: string, isAllDay: boolean): string | null {
		if (!dateStr) return null;

		// Try to extract just the date portion for all-day tasks
		// or full datetime for timed tasks
		const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})(T(\d{2}:\d{2})(:\d{2})?)?/);
		if (!dateMatch) return null;

		if (isAllDay || !dateMatch[3]) {
			return dateMatch[1]; // Just date: YYYY-MM-DD
		}

		return `${dateMatch[1]}T${dateMatch[3]}`; // Date + time: YYYY-MM-DDTHH:MM
	}

	private parseDateFromFrontmatter(dateStr: string): string {
		// Return as-is, the date handling will be done by dateMan
		return dateStr;
	}

	private cleanDescriptionForTaskNote(description: string): string {
		// Remove Obsidian URLs that were added by the plugin
		const obsidianUrlRegex = /\[.*?\]\(obsidian:\/\/open\?vault=.*?\)/g;
		let cleaned = description.replace(obsidianUrlRegex, '');

		// Remove TickTick task links
		const tickTickLinkRegex = /\[link\]\(https:\/\/.*?ticktick\.com.*?\)/g;
		cleaned = cleaned.replace(tickTickLinkRegex, '');

		// Clean up extra whitespace
		cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

		return cleaned;
	}

	private parseYamlFrontmatter(yaml: string): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		const lines = yaml.split('\n');
		let currentKey: string | null = null;
		let currentArray: unknown[] | null = null;

		for (const line of lines) {
			// Check for array item
			const arrayMatch = line.match(/^\s+-\s+(.*)$/);
			if (arrayMatch && currentKey) {
				if (!currentArray) {
					currentArray = [];
					result[currentKey] = currentArray;
				}
				currentArray.push(this.parseYamlValue(arrayMatch[1]));
				continue;
			}

			// Check for key-value pair
			const kvMatch = line.match(/^([^:]+):\s*(.*)$/);
			if (kvMatch) {
				currentKey = kvMatch[1].trim();
				const value = kvMatch[2].trim();

				if (value) {
					result[currentKey] = this.parseYamlValue(value);
					currentArray = null;
				} else {
					// Might be start of array
					currentArray = null;
				}
			}
		}

		return result;
	}

	private parseYamlValue(value: string): unknown {
		// Remove quotes
		if ((value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))) {
			return value.slice(1, -1);
		}

		// Check for boolean
		if (value === 'true') return true;
		if (value === 'false') return false;

		// Check for number
		const num = Number(value);
		if (!isNaN(num) && value !== '') return num;

		return value;
	}

	private yamlValue(value: unknown): string {
		if (typeof value === 'string') {
			// Quote strings that might be ambiguous
			if (value.includes(':') || value.includes('#') ||
				value.includes('[') || value.includes(']') ||
				value.startsWith('@') || value.startsWith('[[')) {
				return `"${value.replace(/"/g, '\\"')}"`;
			}
			return value;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		return String(value);
	}

	private extractChecklistItems(body: string): ITaskItem[] {
		const items: ITaskItem[] = [];

		// Match checklist items with IDs: - [ ] or - [x] text %%id%%
		const itemRegex = /^-\s+\[([ xX])\]\s+(.*?)\s*%%([a-f0-9]+)%%\s*$/gm;
		let match;

		while ((match = itemRegex.exec(body)) !== null) {
			items.push({
				id: match[3],
				title: match[2].trim(),
				status: match[1].toLowerCase() === 'x' ? 2 : 0
			});
		}

		return items;
	}

	private extractNotesFromBody(body: string): string {
		// Remove user content section first
		let cleanBody = body;
		const separatorIndex = cleanBody.indexOf('\n---\n');
		if (separatorIndex !== -1) {
			cleanBody = cleanBody.substring(0, separatorIndex);
		}

		// Extract Notes section
		const notesMatch = cleanBody.match(/## Notes\n([\s\S]*?)(?=\n## |\n---\n|$)/i);
		if (notesMatch) {
			return notesMatch[1].trim();
		}

		// If no Notes section, check for Description section (backward compatibility)
		const descMatch = cleanBody.match(/## Description\n([\s\S]*?)(?=\n## |\n---\n|$)/i);
		if (descMatch) {
			return descMatch[1].trim();
		}

		// If no sections found, treat entire body (minus checklist) as notes for backward compatibility
		const withoutChecklist = cleanBody.replace(/## Checklist[\s\S]*?(?=\n---|\n##|$)/i, '').trim();
		return withoutChecklist;
	}
}
