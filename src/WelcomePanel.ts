import * as vscode from "vscode";

export class WelcomePanel {
  public static currentPanel: WelcomePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.html = this._getWebviewContent();
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (WelcomePanel.currentPanel) {
      WelcomePanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "flavourtownWelcome",
      "Welcome to Flavourtown",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
  }

  public dispose() {
    WelcomePanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Flavourtown</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                padding: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            h1 {
                color: var(--vscode-textLink-foreground);
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
            }
            button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 10px 20px;
                cursor: pointer;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Welcome to Flavourtown IDE Extension! 🍔</h1>
            <p>We're glad to have you here. This extension helps you track your coding stats in style.</p>
            
            <h2>Getting Started</h2>
            <ul>
                <li>Check the sidebar for your daily stats.</li>
                <li>Use the refresh button to update your data.</li>
            </ul>

            <br/>
            <button onclick="const vscode = acquireVsCodeApi(); vscode.postMessage({command: 'close'})">Get Started</button>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            window.addEventListener('message', event => {
                const message = event.data; // The JSON data our extension sent
            });
        </script>
    </body>
    </html>`;
  }
}
