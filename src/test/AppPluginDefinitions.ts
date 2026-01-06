/**
 * Mock definitions for Obsidian API used in tests.
 * This file is aliased to 'obsidian' in vitest.config.
 */

// Mock Notice class
export class Notice {
	constructor(message: string, timeout?: number) {
		// No-op for tests
	}
}

// Mock App class
export class App {
	vault = {
		getName: () => 'test-vault',
		getAbstractFileByPath: () => null,
		getMarkdownFiles: () => [],
		read: async () => '',
		modify: async () => {},
		create: async () => ({}),
		createFolder: async () => {},
		trash: async () => {},
	};
	workspace = {
		getActiveFile: () => null,
		openLinkText: async () => {},
	};
	metadataCache = {
		getFileCache: () => null,
	};
}

// Mock TFile class
export class TFile {
	path: string = '';
	name: string = '';
	basename: string = '';
	extension: string = 'md';
	stat = {
		mtime: Date.now(),
		ctime: Date.now(),
		size: 0,
	};
	parent: TFolder | null = null;
}

// Mock TFolder class
export class TFolder {
	path: string = '';
	name: string = '';
	children: (TFile | TFolder)[] = [];
	parent: TFolder | null = null;
	isRoot(): boolean {
		return this.parent === null;
	}
}

// Mock TAbstractFile class
export class TAbstractFile {
	path: string = '';
	name: string = '';
	parent: TFolder | null = null;
}

// Mock Plugin class
export class Plugin {
	app: App;
	manifest: any;

	constructor(app: App, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	loadData(): Promise<any> {
		return Promise.resolve({});
	}

	saveData(data: any): Promise<void> {
		return Promise.resolve();
	}

	addCommand(command: any): any {
		return command;
	}

	addSettingTab(tab: any): void {}

	registerEvent(event: any): void {}
}

// Mock PluginSettingTab class
export class PluginSettingTab {
	app: App;
	plugin: Plugin;
	containerEl: HTMLElement;

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement('div');
	}

	display(): void {}
	hide(): void {}
}

// Mock Modal class
export class Modal {
	app: App;
	contentEl: HTMLElement;
	modalEl: HTMLElement;

	constructor(app: App) {
		this.app = app;
		this.contentEl = document.createElement('div');
		this.modalEl = document.createElement('div');
	}

	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}

// Mock Setting class
export class Setting {
	settingEl: HTMLElement;
	infoEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = document.createElement('div');
		this.infoEl = document.createElement('div');
		this.nameEl = document.createElement('div');
		this.descEl = document.createElement('div');
		this.controlEl = document.createElement('div');
	}

	setName(name: string): this { return this; }
	setDesc(desc: string): this { return this; }
	setClass(cls: string): this { return this; }
	setTooltip(tooltip: string): this { return this; }
	setHeading(): this { return this; }
	setDisabled(disabled: boolean): this { return this; }
	addButton(cb: (button: any) => any): this { return this; }
	addToggle(cb: (toggle: any) => any): this { return this; }
	addText(cb: (text: any) => any): this { return this; }
	addTextArea(cb: (textArea: any) => any): this { return this; }
	addDropdown(cb: (dropdown: any) => any): this { return this; }
	addSlider(cb: (slider: any) => any): this { return this; }
	addExtraButton(cb: (button: any) => any): this { return this; }
	addSearch(cb: (search: any) => any): this { return this; }
	then(cb: (setting: this) => any): this { return this; }
}

// Mock Editor interface
export interface Editor {
	getCursor(): { line: number; ch: number };
	getLine(line: number): string;
	setValue(content: string): void;
	getValue(): string;
	replaceRange(replacement: string, from: any, to?: any): void;
}

// Mock MarkdownView
export class MarkdownView {
	file: TFile | null = null;
	editor: Editor | null = null;
	getViewType(): string { return 'markdown'; }
}

// Mock MarkdownFileInfo interface
export interface MarkdownFileInfo {
	file: TFile | null;
}

// Mock MarkdownRenderChild
export class MarkdownRenderChild {
	containerEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
	}

	load(): void {}
	unload(): void {}
	register(cb: () => any): void {}
	registerEvent(event: any): void {}
	registerInterval(id: number): number { return id; }
}

// Mock MarkdownPostProcessorContext
export interface MarkdownPostProcessorContext {
	docId: string;
	sourcePath: string;
	frontmatter: any;
	addChild(child: MarkdownRenderChild): void;
	getSectionInfo(el: HTMLElement): any;
}

// Mock ListItemCache interface
export interface ListItemCache {
	position: { start: { line: number; col: number; offset: number }; end: { line: number; col: number; offset: number } };
	parent: number;
	task?: string;
}

// Mock Platform
export const Platform = {
	isDesktop: true,
	isDesktopApp: true,
	isMobile: false,
	isMobileApp: false,
	isIosApp: false,
	isAndroidApp: false,
	isMacOS: true,
	isWin: false,
	isLinux: false,
	isSafari: false,
};

// Mock Scope
export class Scope {
	register(modifiers: string[], key: string, func: () => any): void {}
	unregister(modifiers: string[], key: string): void {}
}

// Mock ISuggestOwner interface
export interface ISuggestOwner<T> {
	renderSuggestion(value: T, el: HTMLElement): void;
	selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void;
}

// Mock normalizePath function
export function normalizePath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Mock requestUrl function
export interface RequestUrlParam {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string | ArrayBuffer;
	contentType?: string;
	throw?: boolean;
}

export interface RequestUrlResponse {
	status: number;
	headers: Record<string, string>;
	text: string;
	json: any;
	arrayBuffer: ArrayBuffer;
}

export async function requestUrl(request: RequestUrlParam | string): Promise<RequestUrlResponse> {
	return {
		status: 200,
		headers: {},
		text: '',
		json: {},
		arrayBuffer: new ArrayBuffer(0),
	};
}
