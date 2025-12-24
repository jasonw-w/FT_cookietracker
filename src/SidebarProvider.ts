import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log('[Flavourtown] resolveWebviewView called!');
    this._view = webviewView;

    // Allow scripts in the webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Set the HTML content
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Fetch data immediately when view loads
    void this.refreshData();
  }

  public async refreshData() {
    console.log('[Flavourtown] refreshData called');
    console.log('userefreshed');
    if (!this._view) { 
      console.log('[Flavourtown] No _view, returning');
      return; 
    }

    // Show loading state
    this._view.webview.html = this._getHtmlForWebview(
      this._view.webview,
      `<div class="empty">Fetching stats from Hackatime...</div>`
    );

    try {
      // Run the Python script to generate fresh stats
      console.log('[Flavourtown] Running Python script to fetch stats...');
      await this._runPythonScript();
      
      console.log('[Flavourtown] About to read stats.json');
      const data = await this._readStatsFromFile();
      if (!data) {
        this._view.webview.html = this._getHtmlForWebview(
          this._view.webview,
          `<div class="empty">No stats yet. Check that Python script ran successfully.</div>`
        );
        return;
      }

      console.log('[Flavourtown] Loaded stats.json');
      const htmlContent = this._generateStatsHtml(data);
      this._view.webview.html = this._getHtmlForWebview(this._view.webview, htmlContent);
    } catch (err) {
      console.error('[Flavourtown] Failed to fetch/read stats', err);
      const message = err instanceof Error ? err.message : String(err);
      this._view.webview.html = this._getHtmlForWebview(
        this._view.webview,
        `<div class="empty">Error: ${message}<br/><br/>Make sure Python and required packages are installed.</div>`
      );
    }
  }

  private async _runPythonScript(): Promise<void> {
    const scriptPath = path.join(this._extensionUri.fsPath, 'python_scripts', 'get_data.py');
    const cwd = this._extensionUri.fsPath;
    
    // Try python3 first, fall back to python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const command = `${pythonCmd} "${scriptPath}"`;
    
    console.log('[Flavourtown] Executing:', command);
    console.log('[Flavourtown] CWD:', cwd);
    
    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      if (stderr) {
        console.warn('[Flavourtown] Python stderr:', stderr);
      }
      console.log('[Flavourtown] Python script completed');
    } catch (error: any) {
      // Try alternate Python command if first one failed
      if (error.message?.includes('python') || error.code === 'ENOENT') {
        const altCmd = process.platform === 'win32' ? 'python3' : 'python';
        console.log('[Flavourtown] Retrying with', altCmd);
        const { stdout, stderr } = await execAsync(`${altCmd} "${scriptPath}"`, { cwd });
        if (stderr) {
          console.warn('[Flavourtown] Python stderr:', stderr);
        }
        console.log('[Flavourtown] Python script completed (alternate command)');
      } else {
        throw error;
      }
    }
  }

  private async _readStatsFromFile(): Promise<any | undefined> {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;

    const candidates: vscode.Uri[] = [];
    if (workspaceUri) {
      candidates.push(vscode.Uri.joinPath(workspaceUri, 'storage', 'stats.json'));
    }
    candidates.push(vscode.Uri.joinPath(this._extensionUri, 'storage', 'stats.json'));

    let lastErr: unknown;
    for (const fileUri of candidates) {
      try {
        console.log('[Flavourtown] Reading', fileUri.fsPath);
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const json = new TextDecoder('utf-8').decode(bytes);
        return JSON.parse(json);
      } catch (err) {
        lastErr = err;
        if (err instanceof Error && /ENOENT/i.test(err.message)) {
          console.log('[Flavourtown] Not found:', fileUri.fsPath);
          continue;
        }

        console.log('[Flavourtown] Failed reading', fileUri.fsPath);
      }
    }

    if (lastErr instanceof Error && /ENOENT/i.test(lastErr.message)) {
      return undefined;
    }

    throw lastErr;
  }

  private _generateStatsHtml(data: any): string {
      if (!data) {
        return `<div class="empty">No data available yet.</div>`;
      }

      const languages = Array.isArray(data.languages) ? data.languages : [];
      const languagesHtml = languages.length > 0
        ? languages.map((lang: any) => `
            <div class="stat-item">
                <span class="lang-name">${lang.name}</span>
                <span class="lang-time">${lang.text}</span>
            </div>
        `).join('')
        : `<div class="empty">No languages to show.</div>`;

      const total = data.human_readable || 'N/A';

      return `
        <div class="card">
            <h2>Total Time</h2>
            <div class="total-time">${total}</div>
        </div>
        <h3>Languages</h3>
        <div class="list">
            ${languagesHtml}
        </div>
      `;
  }

  private _getHtmlForWebview(webview: vscode.Webview, content: string = "Loading..."): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: sans-serif; padding: 10px; color: var(--vscode-foreground); }
            .card { background: var(--vscode-editor-background); border: 1px solid var(--vscode-focusBorder); padding: 10px; border-radius: 5px; margin-bottom: 20px; }
            .total-time { font-size: 2em; font-weight: bold; color: var(--vscode-textLink-foreground); }
            .stat-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--vscode-widget-border); }
            .empty { color: var(--vscode-descriptionForeground); padding: 8px 0; }
        </style>
    </head>
    <body>
        ${content}
    </body>
    </html>`;
  }
}   
