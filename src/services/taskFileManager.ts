import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type TickTickSync from '@/main';
import type { ITask } from '@/api/types/Task';
import { getSettings, updateSettings, type ITaskFileIndexEntry } from '@/settings';
import { TaskNotesConverter, type TaskNoteData } from '@/taskNotesConverter';
import log from 'loglevel';

/**
 * TaskFileManager handles CRUD operations for TaskNotes-compatible task files.
 * Each task synced from TickTick can have a corresponding markdown file with
 * YAML frontmatter in the TaskNotes format.
 */
export class TaskFileManager {
	app: App;
	plugin: TickTickSync;
	converter: TaskNotesConverter;

	constructor(app: App, plugin: TickTickSync) {
		this.app = app;
		this.plugin = plugin;
		this.converter = new TaskNotesConverter(app, plugin);
	}

	/**
	 * Create a new task file for a TickTick task
	 */
	async createTaskFile(task: ITask): Promise<TFile | null> {
		const settings = getSettings();
		if (!settings.enableTaskNotes) {
			return null;
		}

		try {
			// Ensure the task notes folder exists
			await this.ensureFolderExists(settings.taskNotesFolder);

			// Generate file name and path
			const fileName = await this.getUniqueFileName(task);
			const filePath = normalizePath(`${settings.taskNotesFolder}/${fileName}.md`);

			// Check if file already exists (by ticktick_id search)
			const existingFile = await this.findTaskFileById(task.id);
			if (existingFile) {
				log.debug(`Task file already exists for ${task.id}, updating instead`);
				await this.updateTaskFile(task, existingFile);
				return existingFile;
			}

			// Generate file content
			const content = this.converter.generateTaskFileContent(task);

			// Create the file
			const file = await this.app.vault.create(filePath, content);

			// Update the index
			this.updateFileIndex(task.id, file.path);

			log.debug(`Created task file: ${filePath}`);
			return file;
		} catch (error) {
			log.error(`Failed to create task file for ${task.id}:`, error);
			return null;
		}
	}

	/**
	 * Update an existing task file with new data from TickTick
	 */
	async updateTaskFile(task: ITask, existingFile: TFile): Promise<void> {
		const settings = getSettings();
		if (!settings.enableTaskNotes) {
			return;
		}

		try {
			// Read existing content to preserve user notes
			const existingContent = await this.app.vault.read(existingFile);
			const existingData = this.converter.parseTaskNoteFile(existingContent);

			// Generate new content, preserving user content
			const newContent = this.converter.generateTaskFileContent(task, existingData.userContent);

			// Update the file
			await this.app.vault.modify(existingFile, newContent);

			// Update the index
			this.updateFileIndex(task.id, existingFile.path);

			log.debug(`Updated task file: ${existingFile.path}`);
		} catch (error) {
			log.error(`Failed to update task file ${existingFile.path}:`, error);
		}
	}

	/**
	 * Delete a task file
	 */
	async deleteTaskFile(taskId: string): Promise<void> {
		const settings = getSettings();
		if (!settings.enableTaskNotes) {
			return;
		}

		try {
			const file = await this.findTaskFileById(taskId);
			if (file) {
				// Move to trash instead of permanent delete
				await this.app.vault.trash(file, false);
				log.debug(`Deleted task file: ${file.path}`);
			}

			// Remove from index
			this.removeFromFileIndex(taskId);
		} catch (error) {
			log.error(`Failed to delete task file for ${taskId}:`, error);
		}
	}

	/**
	 * Find a task file by its TickTick ID
	 */
	async findTaskFileById(tickTickId: string): Promise<TFile | null> {
		const settings = getSettings();

		// First check the index
		const indexed = settings.taskFileIndex[tickTickId];
		if (indexed) {
			const file = this.app.vault.getAbstractFileByPath(indexed.filePath);
			if (file instanceof TFile) {
				// Verify the file still has the correct ticktick_id
				const isValid = await this.verifyTaskFileId(file, tickTickId);
				if (isValid) {
					return file;
				}
			}
			// Index is stale, remove it
			this.removeFromFileIndex(tickTickId);
		}

		// Fallback: scan the task notes folder
		const folder = this.app.vault.getAbstractFileByPath(settings.taskNotesFolder);
		if (!(folder instanceof TFolder)) {
			return null;
		}

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!file.path.startsWith(settings.taskNotesFolder)) continue;

			const isMatch = await this.verifyTaskFileId(file, tickTickId);
			if (isMatch) {
				// Update index
				this.updateFileIndex(tickTickId, file.path);
				return file;
			}
		}

		return null;
	}

	/**
	 * Read and parse a task file
	 */
	async readTaskFile(file: TFile): Promise<TaskNoteData> {
		const content = await this.app.vault.read(file);
		return this.converter.parseTaskNoteFile(content);
	}

	/**
	 * Extract ITask-compatible data from a task file
	 */
	async getTaskDataFromFile(file: TFile): Promise<Partial<ITask>> {
		const taskNoteData = await this.readTaskFile(file);
		return this.converter.extractTaskData(taskNoteData);
	}

	/**
	 * Get the TickTick ID from a task file
	 */
	async getTickTickIdFromFile(file: TFile): Promise<string | null> {
		const cache = this.app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.ticktick_id) {
			return String(cache.frontmatter.ticktick_id);
		}

		// Fallback: read and parse the file
		const taskData = await this.readTaskFile(file);
		return taskData.frontmatter.ticktick_id as string || null;
	}

	/**
	 * Build/rebuild the task file index by scanning the task notes folder
	 */
	async buildFileIndex(): Promise<Map<string, TFile>> {
		const settings = getSettings();
		const result = new Map<string, TFile>();

		if (!settings.enableTaskNotes) {
			return result;
		}

		const folder = this.app.vault.getAbstractFileByPath(settings.taskNotesFolder);
		if (!(folder instanceof TFolder)) {
			return result;
		}

		const newIndex: Record<string, ITaskFileIndexEntry> = {};

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!file.path.startsWith(settings.taskNotesFolder)) continue;

			const tickTickId = await this.getTickTickIdFromFile(file);
			if (tickTickId) {
				result.set(tickTickId, file);
				newIndex[tickTickId] = {
					tickTickId,
					filePath: file.path,
					lastModified: file.stat.mtime
				};
			}
		}

		// Update settings with new index
		updateSettings({ taskFileIndex: newIndex });

		log.debug(`Built task file index with ${result.size} entries`);
		return result;
	}

	/**
	 * Get all task files in the task notes folder
	 */
	async getAllTaskFiles(): Promise<TFile[]> {
		const settings = getSettings();
		const files: TFile[] = [];

		const folder = this.app.vault.getAbstractFileByPath(settings.taskNotesFolder);
		if (!(folder instanceof TFolder)) {
			return files;
		}

		for (const file of this.app.vault.getMarkdownFiles()) {
			if (file.path.startsWith(settings.taskNotesFolder)) {
				files.push(file);
			}
		}

		return files;
	}

	/**
	 * Get the file path for a task (without actually creating it)
	 */
	getTaskFilePath(task: ITask): string {
		const settings = getSettings();
		const fileName = this.converter.generateFileName(task);
		return normalizePath(`${settings.taskNotesFolder}/${fileName}.md`);
	}

	/**
	 * Check if a task file exists
	 */
	async taskFileExists(taskId: string): Promise<boolean> {
		const file = await this.findTaskFileById(taskId);
		return file !== null;
	}

	// ---- Private helper methods ----

	/**
	 * Ensure a folder exists, creating it if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);
		const folder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!folder) {
			try {
				await this.app.vault.createFolder(normalizedPath);
				log.debug(`Created folder: ${normalizedPath}`);
			} catch (error) {
				// Folder might already exist (race condition)
				if (!this.app.vault.getAbstractFileByPath(normalizedPath)) {
					throw error;
				}
			}
		}
	}

	/**
	 * Get a unique filename, adding a suffix if necessary
	 */
	private async getUniqueFileName(task: ITask): Promise<string> {
		const settings = getSettings();
		const baseName = this.converter.generateFileName(task);
		let fileName = baseName;
		let counter = 1;

		while (true) {
			const filePath = normalizePath(`${settings.taskNotesFolder}/${fileName}.md`);
			const existing = this.app.vault.getAbstractFileByPath(filePath);

			if (!existing) {
				return fileName;
			}

			// Check if existing file is for the same task
			if (existing instanceof TFile) {
				const existingId = await this.getTickTickIdFromFile(existing);
				if (existingId === task.id) {
					return fileName; // Same task, use same filename
				}
			}

			// Generate new filename with counter
			counter++;
			fileName = `${baseName} ${counter}`;
		}
	}

	/**
	 * Verify that a file has the expected ticktick_id
	 */
	private async verifyTaskFileId(file: TFile, expectedId: string): Promise<boolean> {
		const cache = this.app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.ticktick_id) {
			return cache.frontmatter.ticktick_id === expectedId;
		}

		// Fallback: read the file
		try {
			const content = await this.app.vault.read(file);
			const match = content.match(/ticktick_id:\s*["']?([a-f0-9]+)["']?/);
			return match?.[1] === expectedId;
		} catch {
			return false;
		}
	}

	/**
	 * Update the file index for a task
	 */
	private updateFileIndex(tickTickId: string, filePath: string): void {
		const settings = getSettings();
		const newIndex = { ...settings.taskFileIndex };
		newIndex[tickTickId] = {
			tickTickId,
			filePath,
			lastModified: Date.now()
		};
		updateSettings({ taskFileIndex: newIndex });
	}

	/**
	 * Remove a task from the file index
	 */
	private removeFromFileIndex(tickTickId: string): void {
		const settings = getSettings();
		const newIndex = { ...settings.taskFileIndex };
		delete newIndex[tickTickId];
		updateSettings({ taskFileIndex: newIndex });
	}
}
