import * as vscode from "vscode";
import * as path from "path";
import { fetchStats, fetchStore, ProcessedStore, StoreItem } from "./api";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log("[Flavourtown] resolveWebviewView called!");
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
    console.log("[Flavourtown] refreshData called");
    if (!this._view) {
      console.log("[Flavourtown] No _view, returning");
      return;
    }

    // Show loading state
    this._view.webview.html = this._getHtmlForWebview(
      this._view.webview,
      `<div class="empty">Fetching stats from Hackatime...</div>`
    );

    try {
      const config = vscode.workspace.getConfiguration("flavourtown");
      const hackatimeApiKey = [
        config.get<string>("hackatime_api"),
        process.env.HACKATIME_API_KEY,
      ]
        .find((val) => (val ?? "").trim())
        ?.trim();
      const flavourtownApiKey = [
        config.get<string>("flavourtown_api"),
        process.env.FT_API_KEY,
      ]
        .find((val) => (val ?? "").trim())
        ?.trim();
      const username = [
        config.get<string>("username"),
        process.env.HACKATIME_USERNAME,
      ]
        .find((val) => (val ?? "").trim())
        ?.trim();

      if (!hackatimeApiKey || !username) {
        throw new Error("Missing Hackatime API key or Username. Please configure them in settings.");
      }

      // Fetch data using TypeScript API
      console.log("[Flavourtown] Fetching stats and store data...");
      
      // Fetch stats and store independently so one failure doesn't block the other
      let statsData: any = null;
      try {
        statsData = await fetchStats(hackatimeApiKey, username, this._extensionUri);
      } catch (e) {
        console.error("[Flavourtown] Hackatime fetch failed:", e);
        throw e; // Stats are critical, so we rethrow if this fails
      }

      let storeData: ProcessedStore | null = null;
      if (flavourtownApiKey) {
        try {
          storeData = await fetchStore(flavourtownApiKey, this._extensionUri);
        } catch (e) {
          console.error("[Flavourtown] Store fetch failed (continuing without store data):", e);
          // We continue without store data
        }
      }

      if (!statsData) {
        this._view.webview.html = this._getHtmlForWebview(
          this._view.webview,
          `<div class="empty">No stats available.</div>`
        );
        return;
      }

      // Load store data for target progress
      const storeItems: StoreItem[] = storeData ? storeData.raw_data.items : [];
      
      const targetName = config.get<string>("storeItem")?.trim();
      const country = (config.get<string>("country") ?? "us")
        .trim()
        .toLowerCase();
      const targetItem = targetName
        ? storeItems.find((i) => (i.name ?? "").trim() === targetName)
        : undefined;

      const priceString =
        targetItem?.ticket_cost?.[country] ??
        targetItem?.ticket_cost?.base_cost;
      const price = priceString ? parseFloat(String(priceString)) : undefined;

      // Calculate cookies per-project to avoid ln(1+h) diminishing returns
      // Sum of ln(1+h1) + ln(1+h2) > ln(1+h1+h2) due to logarithm properties
      const quality = Math.min(
        15,
        Math.max(1, Number(config.get<number>("quality") ?? 10))
      );
      const k = Number(config.get<number>("k") ?? 1);
      const beta = Number(config.get<number>("beta") ?? 2);

      const projects = Array.isArray(statsData.projects) ? statsData.projects : [];
      let cookiesEarned = 0;

      if (projects.length > 0) {
        // Calculate cookies for each project separately, then sum
        for (const proj of projects) {
          const projHours = Number(proj.hours ?? 0);
          cookiesEarned +=
            88 *
            Math.pow(quality / 15, k) *
            (1 + beta * Math.log(1 + projHours));
        }
      } else {
        // Fallback to total hours if no project breakdown
        const totalHours = Number(statsData.total_seconds ?? 0) / 3600;
        cookiesEarned =
          88 *
          Math.pow(quality / 15, k) *
          (1 + beta * Math.log(1 + totalHours));
      }

      const cookiesNeeded =
        price !== undefined ? Math.max(price - cookiesEarned, 0) : undefined;
      const progressPct =
        price !== undefined && price > 0
          ? Math.min((cookiesEarned / price) * 100, 100)
          : undefined;

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

      console.log("[Flavourtown] Data loaded successfully");
      const htmlContent = this._generateStatsHtml(statsData, targetInfo);
      this._view.webview.html = this._getHtmlForWebview(
        this._view.webview,
        htmlContent
      );
    } catch (err) {
      console.error("[Flavourtown] Failed to fetch stats", err);
      const message = err instanceof Error ? err.message : String(err);
      this._view.webview.html = this._getHtmlForWebview(
        this._view.webview,
        `<div class="empty">Error: ${message}<br/><br/>Make sure APIs and Username is set in setting (gear icon at the top, look at README.md for tutorial finding your apis.)</div>`
      );
    }
  }

  private _generateStatsHtml(
    data: any,
    targetInfo?: {
      name: string;
      price?: number;
      country: string;
      cookiesEarned: number;
      cookiesNeeded?: number;
      progressPct?: number;
    }
  ): string {
    if (!data) {
      return `<div class="empty">No data available yet.</div>`;
    }

    const languages = Array.isArray(data.languages) ? data.languages : [];
    const languagesHtml =
      languages.length > 0
        ? languages
            .map(
              (lang: any) => `
            <div class="stat-item">
                <span class="lang-name">${lang.name}</span>
                <span class="lang-time">${lang.text}</span>
            </div>
        `
            )
            .join("")
        : `<div class="empty">No languages to show.</div>`;

    const total = data.human_readable || "N/A";

    const targetHtml = targetInfo
      ? `
          <div class="card">
            <h3>Target Item</h3>
            <div class="target-row">
              <div>
                <div class="target-name">${targetInfo.name}</div>
                <div class="target-price">Cost: ${
                  targetInfo.price ?? "N/A"
                } tickets (${targetInfo.country.toUpperCase()})</div>
              </div>
              <div class="target-earned">${targetInfo.cookiesEarned.toFixed(
                1
              )} cookies earned (predicted)</div>
            </div>
            ${
              targetInfo.progressPct !== undefined
                ? `
              <div class="progress">
                <div class="progress-bar" style="width:${targetInfo.progressPct.toFixed(
                  1
                )}%"></div>
              </div>
              <div class="progress-meta">
                ${targetInfo.progressPct.toFixed(1)}% complete${
                    targetInfo.cookiesNeeded !== undefined
                      ? ` · ${targetInfo.cookiesNeeded.toFixed(
                          1
                        )} cookies remaining<br>Note: This is an estimate based on current data, can be inaccurate.`
                      : ""
                  }
              </div>
            `
                : '<div class="empty">No price found for this item.</div>'
            }
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

  private _getHtmlForWebview(
    webview: vscode.Webview,
    content: string = "Loading..."
  ): string {
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
