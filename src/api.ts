import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// Interfaces for Hackatime API
interface HackatimeLanguage {
  name: string;
  total_seconds: number;
  percent: number;
  digital: string;
  text: string;
  hours: number;
  minutes: number;
}

interface HackatimeProject {
  name: string;
  total_seconds: number;
  percent: number;
  digital: string;
  text: string;
  hours: number;
  minutes: number;
}

interface HackatimeStats {
  status: string;
  data: {
    username: string;
    total_seconds: number;
    human_readable_total: string;
    daily_average: number;
    human_readable_daily_average: string;
    languages: HackatimeLanguage[];
    projects: HackatimeProject[];
  };
}

// Interfaces for Flavourtown Store API
export interface StoreItem {
  name: string;
  ticket_cost: {
    base_cost: number;
    [countryCode: string]: number;
  };
  enabled: boolean;
  type?: string;
}

export type StoreApiResponse = StoreItem[];

export interface StoreData {
  items: StoreItem[];
}

// Processed Data Interfaces
export interface ProcessedStats {
  total_seconds: number;
  human_readable: string;
  languages: HackatimeLanguage[];
  projects: { name: string; hours: number; seconds: number }[];
}

export interface ProcessedStore {
  item_names: string[];
  enabled_items: { name: string; enabled: boolean }[];
  ticket_costs: { name: string; cost: any }[];
  raw_data: StoreData;
}

const HACKATIME_BASE_URL = "https://hackatime.hackclub.com/api/v1";
const FLAVOURTOWN_BASE_URL = "https://flavortown.hackclub.com/api/v1";

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  let text_val = "";
  if (hours > 0) {
    text_val = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    text_val = `${minutes}m`;
  } else {
    text_val = `${secs}s`;
  }
  
  const digital = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  
  return {
    text: text_val,
    hours,
    minutes,
    digital,
  };
}

export async function fetchStats(
  apiKey: string,
  username: string,
  extensionUri: vscode.Uri
): Promise<ProcessedStats> {
  const startDate = "2025-12-15";
  const endDate = "2026-3-31";
  
  const url = `${HACKATIME_BASE_URL}/users/${username}/stats?start=${startDate}&end=${endDate}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Hackatime API error: ${response.statusText}`);
    }

    const data = (await response.json()) as HackatimeStats;
    
    if (!data || !data.data) {
      throw new Error("Invalid response from Hackatime API");
    }

    // Process Data
    const languages = data.data.languages || [];
    const projects = data.data.projects || [];
    const totalSecondsAll = data.data.total_seconds || 0;
    
    let textSeconds = 0;
    let pythonEntry: HackatimeLanguage | null = null;
    const keptLanguages: HackatimeLanguage[] = [];
    
    for (const lang of languages) {
      const name = (lang.name || "").trim();
      if (name.toLowerCase() === "text") {
        textSeconds += lang.total_seconds || 0;
        continue;
      }
      if (name.toLowerCase() === "python") {
        pythonEntry = lang;
      }
      keptLanguages.push(lang);
    }
    
    if (textSeconds > 0) {
      if (pythonEntry) {
        const pythonSeconds = (pythonEntry.total_seconds || 0) + textSeconds;
        const fmt = formatTime(pythonSeconds);
        pythonEntry.total_seconds = pythonSeconds;
        pythonEntry.text = fmt.text;
        pythonEntry.hours = fmt.hours;
        pythonEntry.minutes = fmt.minutes;
        pythonEntry.digital = fmt.digital;
        
        if (totalSecondsAll) {
          pythonEntry.percent = (pythonSeconds / totalSecondsAll) * 100.0;
        }
      } else {
        const fmt = formatTime(textSeconds);
        const newPy: HackatimeLanguage = {
          name: "Python",
          total_seconds: textSeconds,
          text: fmt.text,
          hours: fmt.hours,
          minutes: fmt.minutes,
          digital: fmt.digital,
          percent: totalSecondsAll ? (textSeconds / totalSecondsAll) * 100.0 : 0
        };
        keptLanguages.push(newPy);
      }
    }
    
    const projectList = projects.map(proj => ({
      name: proj.name || "Unknown",
      hours: (proj.total_seconds || 0) / 3600.0,
      seconds: proj.total_seconds || 0
    }));
    
    const output: ProcessedStats = {
      total_seconds: data.data.total_seconds,
      human_readable: data.data.human_readable_total,
      languages: keptLanguages,
      projects: projectList
    };
    
    // Save to file
    const storageDir = path.join(extensionUri.fsPath, "storage");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(storageDir, "stats.json"),
      JSON.stringify(output, null, 4),
      "utf-8"
    );
    
    return output;
    
  } catch (error) {
    console.error("Error fetching stats:", error);
    throw error;
  }
}

export async function fetchStore(
  apiKey: string,
  extensionUri: vscode.Uri
): Promise<ProcessedStore> {
  const url = `${FLAVOURTOWN_BASE_URL}/store`;
  
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Flavourtown Store API error: ${response.statusText}`);
    }

    const data = (await response.json()) as StoreApiResponse;
    
    if (!data || !Array.isArray(data)) {
       console.error("Invalid Store API response:", JSON.stringify(data));
       throw new Error("Invalid response from Flavourtown Store API");
    }

    // Filter and Sort
    const items = data.filter(i => 
      !((i.type || "").toLowerCase().includes("accessory"))
    );
    
    items.sort((a, b) => {
      const costA = a.ticket_cost.base_cost;
      const costB = b.ticket_cost.base_cost;
      return costA - costB;
    });
    
    const output: ProcessedStore = {
      item_names: items.map(i => i.name),
      enabled_items: items.map(i => ({ name: i.name, enabled: i.enabled })),
      ticket_costs: items.map(i => ({ name: i.name, cost: i.ticket_cost })),
      raw_data: { items: items }
    };
    
    // Save to file
    const storageDir = path.join(extensionUri.fsPath, "storage");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(storageDir, "ft_store.json"),
      JSON.stringify(output, null, 4),
      "utf-8"
    );
    
    return output;

  } catch (error) {
    console.error("Error fetching store:", error);
    throw error;
  }
}
