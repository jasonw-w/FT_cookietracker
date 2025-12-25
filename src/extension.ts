// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "flavourtown-sidebar" is now active!');

	// Create the provider once so we can reuse it in the command and registration
	const sidebarProvider = new SidebarProvider(context.extensionUri);

	// Register the refresh command that calls the provider's refreshData
	const refreshCommand = vscode.commands.registerCommand(
	  "flavourtown-sidebar.refreshStats",
	  () => sidebarProvider.refreshData()
	);
	context.subscriptions.push(refreshCommand);

	const disposable = vscode.commands.registerCommand('flavourtown-sidebar.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from flavourtown-sidebar!');
	});

	context.subscriptions.push(disposable);

	// Open the extension's settings view in VS Code settings UI
	const openSettings = vscode.commands.registerCommand(
		'flavourtown-sidebar.openSettings',
		() => vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Jasonw-w.flavourtown-sidebar')
	);

	context.subscriptions.push(openSettings);

	// Picker: choose a Flavourtown store item (with price) and save to settings
	const pickStoreItem = vscode.commands.registerCommand(
		'flavourtown-sidebar.pickStoreItem',
		async () => {
			const config = vscode.workspace.getConfiguration('flavourtown');
			const items = await loadStoreItems(context);
			if (!items.length) {
				vscode.window.showWarningMessage('No store items found. Run the fetch script to generate storage/ft_store.json.');
				return;
			}

			const quickPickItems = items.map((item) => {
				const baseCost = item.ticket_cost?.base_cost ?? 'N/A';
				return {
					label: `${item.name} — ${baseCost} tickets`,
					description: item.description ?? '',
					detail: item.long_description ?? '',
					item,
				};
			});

			const selection = await vscode.window.showQuickPick(quickPickItems, {
				placeHolder: 'Select your preferred Flavourtown store item',
				matchOnDescription: true,
				matchOnDetail: true,
			});

			if (!selection) { return; }

			await config.update('storeItem', selection.item.name, vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage(`Flavourtown store item set to ${selection.item.name}`);
		}
	);

	context.subscriptions.push(pickStoreItem);

	// Register the WebviewViewProvider
	console.log('[Flavourtown] Registering WebviewViewProvider for flavourtown-data');
    
	try {
		const registration = vscode.window.registerWebviewViewProvider(
			"flavourtown-data",
			sidebarProvider
		);
		console.log('[Flavourtown] WebviewViewProvider registered successfully');
		context.subscriptions.push(registration);
	} catch (err) {
		console.error('[Flavourtown] Failed to register WebviewViewProvider:', err);
	}
}

export function deactivate() {}

// Load store items from storage/ft_store.json (workspace first, extension fallback)
async function loadStoreItems(context: vscode.ExtensionContext): Promise<any[]> {
	const decoder = new TextDecoder('utf-8');
	const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;

	const candidates: vscode.Uri[] = [];
	if (workspaceUri) {
		candidates.push(vscode.Uri.joinPath(workspaceUri, 'storage', 'ft_store.json'));
	}
	candidates.push(vscode.Uri.joinPath(context.extensionUri, 'storage', 'ft_store.json'));

	for (const uri of candidates) {
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const json = decoder.decode(bytes);
			const data = JSON.parse(json);
			const items = data?.raw_data?.items ?? data?.items ?? [];
			if (Array.isArray(items) && items.length) {
				return items as any[];
			}
		} catch (err) {
			continue;
		}
	}

	return [];
}

