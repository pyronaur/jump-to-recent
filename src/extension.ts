import * as vscode from 'vscode';

type RecentFile = {
	path: string;
	timestamp: number;
};

class RecentFilesManager {
	private recentFiles: RecentFile[] = [];
	private activeFilePath: string | null = null;

	public loadInitialFiles() {
		// Load initial files if any are open
		const openFiles = vscode.window.visibleTextEditors.map(editor => editor.document.uri.fsPath);
		this.recentFiles = openFiles.map(path => ({
			path,
			timestamp: Date.now(),
		}));
		// Update the active file path
		const activeEditor = vscode.window.activeTextEditor;
		this.activeFilePath = activeEditor ? activeEditor.document.uri.fsPath : null;
	}

	public push(document: vscode.TextDocument) {
		if (document.isUntitled || document.uri.scheme === 'git') {
			return;
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (!workspaceFolder) {
			return;
		}

		const ignorePaths = [
			'/workbench-colors',
			'/textmate-colors',
			'/token-styling',
			'/launch',
			'/settings',
			'/settings/resourceLanguage',
			'.vscode/settings.json',
			'/settings/folder',
			'node_modules',
		];

		if (ignorePaths.some(path => document.uri.path.includes(path))) {
			return;
		}

		const filePath = document.uri.fsPath;
		const activeEditor = vscode.window.activeTextEditor;
		const activeFilePath = activeEditor?.document.uri.fsPath;
		if (activeFilePath === filePath) {
			this.activeFilePath = filePath;
			return;
		}

		const foundIndex = this.recentFiles.findIndex(file => file.path === filePath);
		if (foundIndex !== -1) {
			this.recentFiles.splice(foundIndex, 1); // remove the found file
		}

		// Add to the start of the list
		this.recentFiles.unshift({
			path: filePath,
			timestamp: Date.now()
		});
	}

	public getAll() {
		return this.recentFiles
			.filter(file => file.path !== this.activeFilePath)
			.sort((a, b) => b.timestamp - a.timestamp);
	}

	public remove(path: string) {
		this.recentFiles = this.recentFiles.filter(file => file.path !== path);
	}

	public clear() {
		this.recentFiles = [];
	}
}

const recentFilesManager = new RecentFilesManager();
let quickPick: vscode.QuickPick<vscode.QuickPickItem> | undefined = undefined;
let quickPickIndex = 0;

async function openRecentFile() {
	// If the quick pick is already open, we simply need to refresh it, not create a new one
	if (quickPick) {
		quickPick.hide(); // hide the existing quick pick before showing it again
	}

	const recentFiles = recentFilesManager.getAll();

	if (recentFiles.length === 0) {
		vscode.window.showInformationMessage('No recent files found.');
		return;
	}

	const items: vscode.QuickPickItem[] = recentFiles.map(item => {
		const fileRelativePath = vscode.workspace.asRelativePath(item.path, false);
		return {
			label: fileRelativePath,
			description: item.path,
		};
	});

	// Determine the index of the file that was active when the QuickPick was last closed
	const currentActiveFileIndex = items.findIndex(item => item.description === vscode.window.activeTextEditor?.document.uri.fsPath);
	quickPickIndex = currentActiveFileIndex >= 0 ? currentActiveFileIndex : 0;

	quickPick = vscode.window.createQuickPick();
	quickPick.items = items;
	quickPick.onDidChangeSelection(selection => {
		if (selection[0]) {
			quickPickIndex = items.indexOf(selection[0]);
		}
	});
	quickPick.onDidAccept(() => {
		const selected = quickPick?.selectedItems[0];
		if (selected && selected.description) {
			vscode.workspace.openTextDocument(selected.description).then(document => {
				vscode.window.showTextDocument(document).then(() => {
					quickPick?.dispose();
					quickPick = undefined; // Reset the quick pick
				}, err => {
					vscode.window.showErrorMessage(`Cannot open file: ${err}`);
				});
			});
		}
	});

	quickPick.onDidHide(() => {
		quickPick?.dispose();
		quickPick = undefined;
	});

	// If the current active file is in the list, start the QuickPick without that file selected
	if (currentActiveFileIndex >= 0 && items.length > 1) {
		quickPick.activeItems = [items[(currentActiveFileIndex + 1) % items.length]];
	}

	quickPick.show();
}

function navigateNext() {
	if (!quickPick) {
		openRecentFile();
		return;
	}
	quickPickIndex = (quickPickIndex + 1) % quickPick.items.length;
	quickPick.activeItems = [quickPick.items[quickPickIndex]];
	quickPick.show();
}

function navigatePrevious() {
	if (!quickPick) {
		openRecentFile();
		return;
	}
	quickPickIndex = (quickPickIndex - 1 + quickPick.items.length) % quickPick.items.length;
	quickPick.activeItems = [quickPick.items[quickPickIndex]];
	quickPick.show();
}

export function activate(context: vscode.ExtensionContext) {
	recentFilesManager.loadInitialFiles();

	context.subscriptions.push(vscode.commands.registerCommand('jump-to-recent.open', openRecentFile));
	context.subscriptions.push(vscode.commands.registerCommand('jump-to-recent.navigateNext', navigateNext));
	context.subscriptions.push(vscode.commands.registerCommand('jump-to-recent.navigatePrevious', navigatePrevious));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			recentFilesManager.push(editor.document);
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
		recentFilesManager.push(document);
	}));
}

export function deactivate() {
	// Clean up any resources if needed
}
