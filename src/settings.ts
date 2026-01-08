import type { ITask } from '@/api/types/Task';
import type { IProject } from '@/api/types/Project';
import type { IProjectGroup } from '@/api/types/ProjectGroup';
import type { FileMetadata } from '@/services/cacheOperation';
import { settingsStore } from '@/ui/settings/settingsstore';

/**
 * TaskNotes field mapping configuration.
 * Maps TickTick task properties to custom frontmatter field names.
 */
export interface ITaskNotesFieldMapping {
	/** Frontmatter field for task status (default: "status") */
	status: string;
	/** Frontmatter field for task priority (default: "priority") */
	priority: string;
	/** Frontmatter field for due date (default: "due") */
	due: string;
	/** Frontmatter field for scheduled/start date (default: "scheduled") */
	scheduled: string;
	/** Frontmatter field for project name (default: "project") */
	project: string;
	/** Frontmatter field for tags/contexts (default: "contexts") */
	contexts: string;
}

/**
 * TaskNotes status value mapping.
 * Maps TickTick status (0=open, 2=done) to custom string values.
 */
export interface ITaskNotesStatusValues {
	/** Value for open/incomplete tasks (default: "open") */
	open: string;
	/** Value for completed tasks (default: "done") */
	done: string;
}

/**
 * TaskNotes priority value mapping.
 * Maps TickTick priority (0, 1, 3, 5) to custom string values.
 */
export interface ITaskNotesPriorityValues {
	/** Value for no priority - TickTick 0 (default: "none") */
	none: string;
	/** Value for low priority - TickTick 1 (default: "low") */
	low: string;
	/** Value for normal/medium priority - TickTick 3 (default: "normal") */
	normal: string;
	/** Value for high priority - TickTick 5 (default: "high") */
	high: string;
}

/**
 * Index entry tracking a task file's location.
 * Used for efficient lookup of task files by TickTick ID.
 */
export interface ITaskFileIndexEntry {
	/** The TickTick task ID */
	tickTickId: string;
	/** Path to the task file in the vault */
	filePath: string;
	/** Timestamp of last modification */
	lastModified: number;
}

export interface ITickTickSyncSettings {

	baseURL: string;
	token?: string;
	version?: string;
	automaticSynchronizationInterval: number;
	enableFullVaultSync: boolean;
	tagAndOr: number; // 1 == And ; 2 == Or
	SyncProject: string;
	SyncTag: string;
	defaultProjectId: string;
	defaultProjectName: string;
	TickTickTasksFilePath: string;
	keepProjectFolders: boolean;
	syncNotes: boolean;
	noteDelimiter: string;
	fileLinksInTickTick: string;
	taskLinksInObsidian: string;
	bkupFolder: string;


	debugMode: boolean;
	logLevel: string;
	skipBackup?: boolean;

	//TODO look like one cache object
	inboxID: string;
	inboxName: string;
	checkPoint: number;

	// TaskNotes Integration Settings
	enableTaskNotes: boolean;              // Create task files alongside inline tasks
	taskNotesFolder: string;               // Folder for task files (default: "TaskNotes/Tasks")
	taskNotesFileNameTemplate: string;     // File naming template (default: "{title}")
	taskNotesTagValue: string;             // Tag added to task frontmatter (default: "task")
	taskNotesTitleInFilename: boolean;     // Use filename as title instead of frontmatter
	linkInlineToTaskFile: boolean;         // Wrap inline task title in [[wikilink]]
	taskNotesFieldMapping: ITaskNotesFieldMapping;
	taskNotesStatusValues: ITaskNotesStatusValues;
	taskNotesPriorityValues: ITaskNotesPriorityValues;
	taskFileIndex: Record<string, ITaskFileIndexEntry>; // tickTickId -> file info

	fileMetadata: FileMetadata;
	TickTickTasksData: {
		projects: IProject[];
		projectGroups: IProjectGroup[];
		tasks: ITask[];
	};
	//statistics: any;
}

export const DEFAULT_SETTINGS: ITickTickSyncSettings = {
	baseURL: 'ticktick.com',
	automaticSynchronizationInterval: 300, //default sync interval 300s
	enableFullVaultSync: false,
	tagAndOr: 1,
	debugMode: false,
	logLevel: 'info',
	SyncProject: '',
	SyncTag: '',
	defaultProjectId: '',
	defaultProjectName: 'Inbox',
	TickTickTasksFilePath: '/',
	keepProjectFolders: false,
	syncNotes: true,
	noteDelimiter: '-------------------------------------------------------------',
	fileLinksInTickTick: 'taskLink',
	taskLinksInObsidian: 'taskLink',
	bkupFolder: '/',

	inboxID: '',
	inboxName: 'Inbox',
	checkPoint: 0,
	skipBackup: false,

	// TaskNotes Integration Defaults
	enableTaskNotes: false,
	taskNotesFolder: 'TaskNotes/Tasks',
	taskNotesFileNameTemplate: '{title}',
	taskNotesTagValue: 'task',
	taskNotesTitleInFilename: false,
	linkInlineToTaskFile: true,
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
	taskFileIndex: {},

	fileMetadata: {},
	TickTickTasksData: {
		projects: [],
		projectGroups: [],
		tasks: []
	}

	//statistics: {}
};

//two places for settings, move all ref from main to here

export let settings: ITickTickSyncSettings = { ...DEFAULT_SETTINGS };

export const getSettings = (): ITickTickSyncSettings => {
	return settings;
};

export const setSettings = (value: ITickTickSyncSettings) => {
	settings = value;
};

export const updateSettings = (newSettings: Partial<ITickTickSyncSettings>): ITickTickSyncSettings => {
	settings = { ...settings, ...newSettings } as const;
	settingsStore.set(settings);
	return getSettings();
};

//TODO move to store

// let projects: IProject[] = [];

export const getProjects = (): IProject[] => {
	return settings.TickTickTasksData.projects;
};

export const updateProjects = (newProjects: IProject[]): IProject[] => {
	settings.TickTickTasksData.projects = newProjects;
	return getProjects();
};

// let tasks: ITask[] = [];

export const getTasks = (): ITask[] => {
	return settings.TickTickTasksData.tasks;
};

export const updateTasks = (newTasks: ITask[]): ITask[] => {
	settings.TickTickTasksData.tasks = newTasks;
	return getTasks();
};

// let projectGroups: IProjectGroup[] = [];

export const getProjectGroups = (): IProjectGroup[] => {
	return settings.TickTickTasksData.projectGroups;
};

export const updateProjectGroups = (newProjectGroups: IProjectGroup[]): IProjectGroup[] => {
	settings.TickTickTasksData.projectGroups = newProjectGroups;
	return getProjectGroups();
};
export const getDefaultFolder = (): string => {
	if (settings.TickTickTasksFilePath === '/') {
		return '';
	} else {
		return settings.TickTickTasksFilePath;
	}
};
