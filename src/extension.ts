import path = require('path');
import * as vscode from 'vscode';

const MAX_RECENT_FILES_DISPLAYED = 10;
const MAX_ITEMS_IN_MEMORY = 100;
const IGNORE_PATHS = [
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

type RecentFile = {
	path: string;
	timestamp: number;
};

class RecentFilesManager {
	private recentFiles: RecentFile[] = [];

	public loadInitialFiles(): void {
		const openFiles = vscode.window.visibleTextEditors.map(editor => editor.document.uri.fsPath);
		this.recentFiles = openFiles.map(path => ({
			path,
			timestamp: Date.now(),
		}));
	}

	public push(document: vscode.TextDocument): void {
		if (document.isUntitled || document.uri.scheme === 'git' || !vscode.workspace.getWorkspaceFolder(document.uri)) {
			return;
		}
		if (IGNORE_PATHS.some(ignorePath => document.uri.path.includes(ignorePath))) {
			return;
		}

		const filePath = document.uri.fsPath;
		this.recentFiles = this.recentFiles.filter(file => file.path !== filePath);
		this.recentFiles.unshift({
			path: filePath,
			timestamp: Date.now()
		});

		if (this.recentFiles.length > MAX_ITEMS_IN_MEMORY) {
			this.recentFiles.pop();
		}
	}

	public getAll(): RecentFile[] {
		const activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
		return this.recentFiles
			.filter(file => file.path !== activeFilePath)
			.sort((a, b) => b.timestamp - a.timestamp);
	}

	public clear(): void {
		this.recentFiles = [];
	}
}

class QuickPickManager {
	private quickPick: vscode.QuickPick<vscode.QuickPickItem> | undefined;
	private quickPickIndex: number = 0;

	constructor (private recentFilesManager: RecentFilesManager) {
		this.initQuickPick();
	}

	private disposeQuickPick(): void {
		this.quickPick?.dispose();
		this.quickPick = undefined;
	}

	private initQuickPick(): void {
		if (this.quickPick) {
			return;
		}
		this.quickPickIndex = 0;
		this.quickPick = vscode.window.createQuickPick();
		this.quickPick.onDidChangeValue(this.onQuickPickValueChanged);
		this.quickPick.onDidHide(() => this.disposeQuickPick());
	}

	private onQuickPickValueChanged = (value: string): void => {
		if (!value) {
			this.showQuickPickItems(this.recentFilesManager.getAll().slice(0, MAX_RECENT_FILES_DISPLAYED));
		} else {
			const filteredItems = this.recentFilesManager.getAll()
				.filter(file => file.path.toLowerCase().includes(value.toLowerCase()));
			this.showQuickPickItems(filteredItems);
		}
	};

	private showQuickPickItems = (files: RecentFile[]): void => {
		if (this.quickPick) {
			this.quickPick.items = files.map(file => {
				const fileRelativePath = vscode.workspace.asRelativePath(file.path, false);
				return {
					label: path.basename(fileRelativePath),
					detail: fileRelativePath,
				};
			});
		}
	};

	public showQuickPick = async (): Promise<void> => {
		this.initQuickPick();
		if (!this.quickPick) {
			vscode.window.showErrorMessage('Failed to initialize quick pick.');
			return;
		}
		this.showQuickPickItems(this.recentFilesManager.getAll().slice(0, MAX_RECENT_FILES_DISPLAYED));
		this.quickPick.onDidAccept(async () => {
			const selected = this.quickPick?.selectedItems[0];
			if (selected?.description) {
				await this.openFile(selected.description);
			}
		});
		this.quickPick.show();
	};

	private async openFile(filePath: string): Promise<void> {
		try {
			const document = await vscode.workspace.openTextDocument(filePath);
			await vscode.window.showTextDocument(document);
		} catch (err) {
			await vscode.window.showErrorMessage(`Cannot open file: ${err}`);
		} finally {
			this.disposeQuickPick();
		}
	}
}

const recentFilesManager = new RecentFilesManager();
const quickPickManager = new QuickPickManager(recentFilesManager);

export function activate(context: vscode.ExtensionContext): void {
	recentFilesManager.loadInitialFiles();

	context.subscriptions.push(vscode.commands.registerCommand('jump-to-recent.open', quickPickManager.showQuickPick));

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			recentFilesManager.push(editor.document);
		}
	}));

	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
		recentFilesManager.push(document);
	}));
}

export function deactivate(): void {
	// Clean up any resources if needed
}
