// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

type RecentFile = {
	path: string;
	timestamp: number;
};

let recentFiles: RecentFile[] = [];

function pushRecentDocument(document: vscode.TextDocument) {
	if (!document) {
		debugger;
	}
	// Ignore untitled files and git files
	if (document.isUntitled || document.fileName.indexOf("git") !== -1) {
		return;
	}

	// Check if file is outside of the workspace
	if (!vscode.workspace.getWorkspaceFolder(document.uri)) {
		return;
	}

	// VSCode populates weird paths when settings are opened. 
	// I don't know how else to check these, 
	// so I'm just going to hardcode them for now.
	const ignorePaths = [
		'/workbench-colors',
		'/textmate-colors',
		'/token-styling',
		'/launch',
		'/settings',
		'/settings/resourceLanguage',
		'.vscode/settings.json',
		'/settings/folder',
	];

	if (ignorePaths.some(path => document.fileName.startsWith(path))) {
		return;
	}

	if( document.fileName.includes('node_modules/') ) {
		return;
	}

	let found = recentFiles.find(file => file.path === document.fileName);

	if (found) {
		found.timestamp = Date.now();
		return;
	}
	recentFiles.push({
		path: document.fileName,
		timestamp: Date.now()
	});
}
let loaded = false;

function getAllOpenFiles() {
	return vscode.window.tabGroups.all
		.flatMap(({ tabs }) => tabs.map((tab: vscode.Tab) => {
			// @ts-ignore - There's a VSCode source code bug - it can't find the input.uri. This is a workaround.
			return tab.input.uri.path as string;
		}));
}

async function autoloadActiveFiles() {
	if (loaded || recentFiles.length > 1) {
		return;
	}
	loaded = true;
	const docs = getAllOpenFiles();
	recentFiles = [
		...recentFiles,
		...docs.map(path => ({
			path: path,
			timestamp: Date.now()
		}))
	];
}

function handleUserInput(path: string) {
	if (path.trim() === '') {
		return;
	}

	const targetDocument = vscode.workspace.openTextDocument(path);
	targetDocument.then(function (document) {
		vscode.window.showTextDocument(document);
	});
}

let selectedIndex = -1;

const quickPickCommand = () => {
	autoloadActiveFiles();

	if (!recentFiles.length) {
		vscode.window.showInformationMessage('No recent files found.');
		return;
	}

	type RecentFileItem = vscode.QuickPickItem & { path: string };
	const items: RecentFileItem[] = recentFiles
		.sort((a, b) => b.timestamp - a.timestamp)
		.map(item => {
			const fileRelativePath = vscode.workspace.asRelativePath(item.path, false);
			return {
				label: fileRelativePath,
				path: item.path,
			};
		})
		.slice(1);

	const quickPick = vscode.window.createQuickPick<RecentFileItem>();
	quickPick.items = items;
	quickPick.activeItems = [items[++selectedIndex % items.length]];
	quickPick.show();
	quickPick.onDidChangeActive(selected => {
		selectedIndex = items.findIndex(item => item.path === selected[0].path);
	});
	quickPick.onDidAccept(() => {
		const selected = quickPick.activeItems[0];
		if (selected) {
			handleUserInput(selected.path);
			selectedIndex = -1;
			quickPick.hide();
		}
	});
};

const quickPickBackCommand = () => {
	selectedIndex = selectedIndex - 2;
	quickPickCommand();
};

const quickPickDeleteCommand = () => {
	// I have no idea why there's off by one hack here.
	// It's late, adjusting the index with +1 works for now.
	const file = recentFiles[selectedIndex + 1];
	if (file) {
		recentFiles = recentFiles.filter(f => f.path !== file.path);
	}
	selectedIndex = selectedIndex - 2;
	quickPickCommand();
};

export function activate(context: vscode.ExtensionContext) {


	context.subscriptions.push(vscode.commands.registerCommand('jump-to-recent.quickPick', quickPickCommand));
	context.subscriptions.push(vscode.commands.registerCommand('jump-to-recent.quickPickBack', quickPickBackCommand));
	context.subscriptions.push(vscode.commands.registerCommand('jump-to-recent.quickPickDelete', quickPickDeleteCommand));
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (!editor) {
			return;
		}
		pushRecentDocument(editor.document);
	}));
	context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(document => {
		pushRecentDocument(document);
	}));
}

export function deactivate() { }
