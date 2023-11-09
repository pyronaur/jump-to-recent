import * as vscode from 'vscode';
import * as path from 'path';

const MAX_RECENT_FILES_DISPLAYED = 11;
const MAX_ITEMS_IN_MEMORY = 33;
const RECENT_FILES_STATE_KEY = 'recentFilesState';

type RecentFile = {
	path: string;
	timestamp: number;
};

class RecentFilesManager {
	private recentFiles: RecentFile[] = [];

	constructor (private context: vscode.ExtensionContext) {
		this.recentFiles = this.context.workspaceState.get<RecentFile[]>(RECENT_FILES_STATE_KEY, []);
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

		this.context.workspaceState.update(RECENT_FILES_STATE_KEY, this.recentFiles);
	}

	public getAll(): RecentFile[] {
		const activeFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
		return this.recentFiles
			.filter(file => file.path !== activeFilePath)
			.sort((a, b) => b.timestamp - a.timestamp);
	}

	public clear(): void {
		this.recentFiles = [];
		this.context.workspaceState.update(RECENT_FILES_STATE_KEY, this.recentFiles);
	}
}

class QuickPickManager {
	private quickPick: vscode.QuickPick<vscode.QuickPickItem & { path: string }> | undefined;
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
		this.quickPick.matchOnDescription = true;
		this.quickPick.matchOnDetail = true;
		this.quickPick.onDidHide(() => this.disposeQuickPick());
	}


	private showQuickPickItems = (files: RecentFile[]): void => {
		if (this.quickPick) {
			this.quickPick.items = files.map(file => {
				const fileRelativePath = vscode.workspace.asRelativePath(file.path, false);
				return {
					label: path.basename(fileRelativePath),
					detail: fileRelativePath,
					path: file.path,
					iconPath: vscode.ThemeIcon.File
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
			if (selected?.path) {
				await this.openFile(selected.path);
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

export function activate(context: vscode.ExtensionContext): void {
	const recentFilesManager = new RecentFilesManager(context);
	const quickPickManager = new QuickPickManager(recentFilesManager);

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
