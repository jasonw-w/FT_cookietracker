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
      // Run the Python script to generate fresh stats and store data
      console.log('[Flavourtown] Running Python scripts to fetch stats and store data...');
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

      // Load store data for target progress
      const storeItems = await this._readStoreFromFile();
      const config = vscode.workspace.getConfiguration('flavourtown');
      const targetName = config.get<string>('storeItem')?.trim();
      const country = (config.get<string>('country') ?? 'us').trim().toLowerCase();
      const targetItem = targetName ? storeItems.find((i) => (i.name ?? '').trim() === targetName) : undefined;

      const priceString = targetItem?.ticket_cost?.[country] ?? targetItem?.ticket_cost?.base_cost;
      const price = priceString ? parseFloat(String(priceString)) : undefined;

      // Expected cookies using f(h) = 88 * (quality^k * (1 + beta * ln(1 + h)))
      const quality = Math.min(15, Math.max(1, Number(config.get<number>('quality') ?? 10)));
      const k = Number(config.get<number>('k') ?? 4);
      const beta = Number(config.get<number>('beta') ?? 2);
      const hours = data.total_seconds ? Number(data.total_seconds) / 3600 : 0;
      const cookiesEarned = 88 * Math.pow((quality)/15, k) * (1 + beta * Math.log(1 + hours));
      const cookiesNeeded = price !== undefined ? Math.max(price - cookiesEarned, 0) : undefined;
      const progressPct = price !== undefined && price > 0 ? Math.min((cookiesEarned / price) * 100, 100) : undefined;

      const targetInfo = targetItem
        ? {
            name: targetItem.name as string,
            price,
            country,
            cookiesEarned,
            cookiesNeeded,
            progressPct,
          }
        : undefined;

      console.log('[Flavourtown] Loaded stats.json');
      const htmlContent = this._generateStatsHtml(data, targetInfo);
      this._view.webview.html = this._getHtmlForWebview(this._view.webview, htmlContent);
    } catch (err) {
      console.error('[Flavourtown] Failed to fetch/read stats', err);
      const message = err instanceof Error ? err.message : String(err);
      this._view.webview.html = this._getHtmlForWebview(
        this._view.webview,
        `<div class="empty">Error: ${message}<br/><br/>Make sure APIs and Username is set in setting (gear icon at the top, look at README.md for tutorial finding your apis.)<br>Make sure Python and required packages are installed.</div>`
      );
    }
  }

  private async _runPythonScript(): Promise<void> {
    const config = vscode.workspace.getConfiguration('flavourtown');
    const hackatimeApiKey = [config.get<string>('hackatime_api'), process.env.HACKATIME_API_KEY]
      .find((val) => (val ?? '').trim())
      ?.trim();
    const flavourtownApiKey = [config.get<string>('flavourtown_api'), process.env.FT_API_KEY]
      .find((val) => (val ?? '').trim())
      ?.trim();
    const username = [config.get<string>('username'), process.env.HACKATIME_USERNAME]
      .find((val) => (val ?? '').trim())
      ?.trim();

    // Warn but proceed so the Python script can still read a .env on disk
    if (!hackatimeApiKey || !username) {
      console.warn('[Flavourtown] No Hackatime API key/username in settings or env; relying on python .env loading.');
    }

    const cwd = this._extensionUri.fsPath;
    const execOptions = {
      cwd,
      env: {
        ...process.env,
        ...(hackatimeApiKey ? { HACKATIME_API_KEY: hackatimeApiKey } : {}),
        ...(flavourtownApiKey ? { FT_API_KEY: flavourtownApiKey } : {}),
        ...(username ? { HACKATIME_USERNAME: username } : {}),
      },
    };
    
    // Try python3 first, fall back to python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const altCmd = process.platform === 'win32' ? 'python3' : 'python';

    const runScript = async (fileName: string) => {
      const script = path.join(this._extensionUri.fsPath, 'python_scripts', fileName);
      const primary = `${pythonCmd} "${script}"`;
      console.log('[Flavourtown] Executing:', primary);
      try {
        const { stderr } = await execAsync(primary, execOptions);
        if (stderr) {
          console.warn('[Flavourtown] Python stderr:', stderr);
        }
        return;
      } catch (error: any) {
        if (error.message?.includes('python') || error.code === 'ENOENT') {
          const fallback = `${altCmd} "${script}"`;
          console.log('[Flavourtown] Retrying with', fallback);
          const { stderr } = await execAsync(fallback, execOptions);
          if (stderr) {
            console.warn('[Flavourtown] Python stderr:', stderr);
          }
          return;
        }
        throw error;
      }
    };

    // Run both scripts on refresh/init
    await runScript('get_data.py');
    await runScript('get_targets.py');
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

  private async _readStoreFromFile(): Promise<any[]> {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const candidates: vscode.Uri[] = [];
    if (workspaceUri) {
      candidates.push(vscode.Uri.joinPath(workspaceUri, 'storage', 'ft_store.json'));
    }
    candidates.push(vscode.Uri.joinPath(this._extensionUri, 'storage', 'ft_store.json'));

    const decoder = new TextDecoder('utf-8');
    for (const fileUri of candidates) {
      try {
        console.log('[Flavourtown] Reading store', fileUri.fsPath);
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const json = decoder.decode(bytes);
        const parsed = JSON.parse(json);
        const items = parsed?.raw_data?.items ?? parsed?.items ?? [];
        if (Array.isArray(items)) {
          return items;
        }
      } catch (err) {
        continue;
      }
    }

    return [];
  }

  private _generateStatsHtml(data: any, targetInfo?: {
    name: string;
    price?: number;
    country: string;
    cookiesEarned: number;
    cookiesNeeded?: number;
    progressPct?: number;
  }): string {
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

      const targetHtml = targetInfo
        ? `
          <div class="card">
            <h3>Target Item</h3>
            <div class="target-row">
              <div>
                <div class="target-name">${targetInfo.name}</div>
                <div class="target-price">Cost: ${targetInfo.price ?? 'N/A'} tickets (${targetInfo.country.toUpperCase()})</div>
              </div>
              <div class="target-earned">${targetInfo.cookiesEarned.toFixed(1)} cookies earned (predicted)</div>
            </div>
            ${targetInfo.progressPct !== undefined ? `
              <div class="progress">
                <div class="progress-bar" style="width:${targetInfo.progressPct.toFixed(1)}%"></div>
              </div>
              <div class="progress-meta">
                ${targetInfo.progressPct.toFixed(1)}% complete${targetInfo.cookiesNeeded !== undefined ? ` · ${targetInfo.cookiesNeeded.toFixed(1)} cookies remaining<br>Note: This is an estimate based on current data, can be inaccurate.` : ''}
              </div>
            ` : '<div class="empty">No price found for this item.</div>'}
          </div>
        `
        : '<div class="card"><h3>Target Item</h3><div class="empty">Set a store item in settings to track progress.</div></div>';

      return `
        <div class="card">
            <h2>Total Time</h2>
            <div class="total-time">${total}</div>
        </div>
        ${targetHtml}
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
            .target-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
            .target-name { font-weight: 600; }
            .target-price { color: var(--vscode-descriptionForeground); }
            .target-earned { color: var(--vscode-foreground); font-weight: 600; }
            .progress { background: var(--vscode-widget-border); height: 8px; border-radius: 999px; overflow: hidden; margin: 8px 0; }
            .progress-bar { background: var(--vscode-textLink-foreground); height: 100%; transition: width 0.2s ease; }
            .progress-meta { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
        </style>
    </head>
    <body>
        ${content}
    </body>
    </html>`;
  }
}   
