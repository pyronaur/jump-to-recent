import * as vscode from 'vscode';

type RecentFile = {
	path: string;
	timestamp: number;
};

class RecentFilesManager {
	private recentFiles: RecentFile[] = [];

	public loadInitialFiles() {
		// Load initial files if any are open
		const openFiles = vscode.window.visibleTextEditors.map(editor => editor.document.uri.fsPath);
		this.recentFiles = openFiles.map(path => ({
			path,
			timestamp: Date.now(),
		}));
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
			console.log("Ignoring file: " + document.uri.path);
			return;
		}

		const filePath = document.uri.fsPath;
		const foundIndex = this.recentFiles.findIndex(file => file.path === filePath);

		if (foundIndex !== -1) {
			this.recentFiles[foundIndex].timestamp = Date.now();
		} else {
			this.recentFiles.push({
				path: filePath,
				timestamp: Date.now()
			});
		}
	}

	public getAll() {
		return this.recentFiles.slice().sort((a, b) => b.timestamp - a.timestamp);
	}

	public remove(path: string) {
		this.recentFiles = this.recentFiles.filter(file => file.path !== path);
	}

	public clear() {
		this.recentFiles = [];
	}
}

const recentFilesManager = new RecentFilesManager();

async function openRecentFile() {
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

	const quickPick = vscode.window.createQuickPick();
	quickPick.items = items;
	quickPick.onDidAccept(() => {
		const selected = quickPick.selectedItems[0];
		if (selected && selected.description) {
			vscode.workspace.openTextDocument(selected.description).then(document => {
				vscode.window.showTextDocument(document).then(() => {
					quickPick.dispose();
				}, err => {
					vscode.window.showErrorMessage(`Cannot open file: ${err}`);
				});
			});
		}
	});

	quickPick.onDidHide(() => quickPick.dispose());
	quickPick.show();
}

export function activate(context: vscode.ExtensionContext) {
	recentFilesManager.loadInitialFiles();
	context.subscriptions.push(vscode.commands.registerCommand('jump-to-recent.open', openRecentFile));
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
