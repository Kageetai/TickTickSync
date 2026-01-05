<script lang="ts">
	import type TickTickSync from '@/main';
	import { settingsStore } from '@/ui/settings/settingsstore';
	import { Notice } from 'obsidian';

	export let plugin: TickTickSync;

	// Reactive bindings from store
	$: enableTaskNotes = $settingsStore.enableTaskNotes;
	$: taskNotesFolder = $settingsStore.taskNotesFolder;
	$: linkInlineToTaskFile = $settingsStore.linkInlineToTaskFile;
	$: taskNotesTagValue = $settingsStore.taskNotesTagValue;

	// Field mapping values
	$: statusField = $settingsStore.taskNotesFieldMapping?.status ?? 'status';
	$: priorityField = $settingsStore.taskNotesFieldMapping?.priority ?? 'priority';
	$: dueField = $settingsStore.taskNotesFieldMapping?.due ?? 'due';
	$: scheduledField = $settingsStore.taskNotesFieldMapping?.scheduled ?? 'scheduled';
	$: projectField = $settingsStore.taskNotesFieldMapping?.project ?? 'project';
	$: contextsField = $settingsStore.taskNotesFieldMapping?.contexts ?? 'contexts';

	// Status values
	$: openStatus = $settingsStore.taskNotesStatusValues?.open ?? 'open';
	$: doneStatus = $settingsStore.taskNotesStatusValues?.done ?? 'done';

	// Priority values
	$: nonePriority = $settingsStore.taskNotesPriorityValues?.none ?? 'none';
	$: lowPriority = $settingsStore.taskNotesPriorityValues?.low ?? 'low';
	$: normalPriority = $settingsStore.taskNotesPriorityValues?.normal ?? 'normal';
	$: highPriority = $settingsStore.taskNotesPriorityValues?.high ?? 'high';

	async function handleEnableChange(checked: boolean) {
		settingsStore.update((s) => ({ ...s, enableTaskNotes: checked }));
		const msg = checked ? 'TaskNotes integration enabled.' : 'TaskNotes integration disabled.';
		new Notice(msg);
		await plugin.saveSettings();
	}

	async function handleFolderChange(value: string) {
		settingsStore.update((s) => ({ ...s, taskNotesFolder: value }));
		await plugin.saveSettings();
	}

	async function handleLinkInlineChange(checked: boolean) {
		settingsStore.update((s) => ({ ...s, linkInlineToTaskFile: checked }));
		await plugin.saveSettings();
	}

	async function handleTagChange(value: string) {
		settingsStore.update((s) => ({ ...s, taskNotesTagValue: value }));
		await plugin.saveSettings();
	}

	async function handleFieldMappingChange(field: string, value: string) {
		settingsStore.update((s) => ({
			...s,
			taskNotesFieldMapping: {
				...s.taskNotesFieldMapping,
				[field]: value
			}
		}));
		await plugin.saveSettings();
	}

	async function handleStatusValueChange(field: string, value: string) {
		settingsStore.update((s) => ({
			...s,
			taskNotesStatusValues: {
				...s.taskNotesStatusValues,
				[field]: value
			}
		}));
		await plugin.saveSettings();
	}

	async function handlePriorityValueChange(field: string, value: string) {
		settingsStore.update((s) => ({
			...s,
			taskNotesPriorityValues: {
				...s.taskNotesPriorityValues,
				[field]: value
			}
		}));
		await plugin.saveSettings();
	}
</script>

<div class="tasknotes-settings">
	<h2>TaskNotes Integration</h2>
	<p class="setting-item-description">
		Create dedicated markdown files for each task with YAML frontmatter compatible with TaskNotes.
		Works alongside existing inline tasks.
	</p>

	<!-- Enable Toggle -->
	<div class="setting-item">
		<div class="setting-item-info">
			<div class="setting-item-name">Enable TaskNotes</div>
			<div class="setting-item-description">
				Create a dedicated markdown file for each task with YAML frontmatter.
			</div>
		</div>
		<div class="setting-item-control">
			<label class="toggle-switch">
				<input
					type="checkbox"
					checked={enableTaskNotes}
					on:change={(e) => handleEnableChange(e.target.checked)}
				/>
				<span class="slider"></span>
			</label>
		</div>
	</div>

	{#if enableTaskNotes}
		<!-- Task Notes Folder -->
		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Task Notes Folder</div>
				<div class="setting-item-description">
					Folder where task files will be created.
				</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={taskNotesFolder}
					on:blur={(e) => handleFolderChange(e.target.value)}
					placeholder="TaskNotes/Tasks"
				/>
			</div>
		</div>

		<!-- Link Inline to Task File -->
		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Link inline tasks to task files</div>
				<div class="setting-item-description">
					Wrap task titles in [[wikilinks]] pointing to the task file.
				</div>
			</div>
			<div class="setting-item-control">
				<label class="toggle-switch">
					<input
						type="checkbox"
						checked={linkInlineToTaskFile}
						on:change={(e) => handleLinkInlineChange(e.target.checked)}
					/>
					<span class="slider"></span>
				</label>
			</div>
		</div>

		<!-- Tag Value -->
		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Task Tag</div>
				<div class="setting-item-description">
					Tag added to task files (e.g., "task").
				</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={taskNotesTagValue}
					on:blur={(e) => handleTagChange(e.target.value)}
					placeholder="task"
				/>
			</div>
		</div>

		<!-- Field Mapping Section -->
		<h3>Frontmatter Field Names</h3>
		<p class="setting-item-description">
			Customize field names to match your TaskNotes settings.
		</p>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Status field</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={statusField}
					on:blur={(e) => handleFieldMappingChange('status', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Priority field</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={priorityField}
					on:blur={(e) => handleFieldMappingChange('priority', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Due date field</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={dueField}
					on:blur={(e) => handleFieldMappingChange('due', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Scheduled field</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={scheduledField}
					on:blur={(e) => handleFieldMappingChange('scheduled', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Project field</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={projectField}
					on:blur={(e) => handleFieldMappingChange('project', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Contexts field</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={contextsField}
					on:blur={(e) => handleFieldMappingChange('contexts', e.target.value)}
				/>
			</div>
		</div>

		<!-- Status Values -->
		<h3>Status Values</h3>
		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Open status value</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={openStatus}
					on:blur={(e) => handleStatusValueChange('open', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Done status value</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={doneStatus}
					on:blur={(e) => handleStatusValueChange('done', e.target.value)}
				/>
			</div>
		</div>

		<!-- Priority Values -->
		<h3>Priority Values</h3>
		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">None priority value</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={nonePriority}
					on:blur={(e) => handlePriorityValueChange('none', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Low priority value</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={lowPriority}
					on:blur={(e) => handlePriorityValueChange('low', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">Normal priority value</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={normalPriority}
					on:blur={(e) => handlePriorityValueChange('normal', e.target.value)}
				/>
			</div>
		</div>

		<div class="setting-item">
			<div class="setting-item-info">
				<div class="setting-item-name">High priority value</div>
			</div>
			<div class="setting-item-control">
				<input
					type="text"
					value={highPriority}
					on:blur={(e) => handlePriorityValueChange('high', e.target.value)}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.tasknotes-settings {
		padding: 1em;
	}

	h2 {
		margin-top: 0;
		margin-bottom: 0.5em;
	}

	h3 {
		margin-top: 1.5em;
		margin-bottom: 0.5em;
		font-size: 1em;
		color: var(--text-muted);
	}
</style>
