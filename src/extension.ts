// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
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

