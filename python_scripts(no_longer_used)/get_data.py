import os
import time

import requests
from dotenv import load_dotenv


_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_SCRIPT_DIR, ".."))
_DOTENV_PATH = os.path.join(_PROJECT_ROOT, ".env")


class requester:
    def __init__(self):
        load_dotenv(dotenv_path=_DOTENV_PATH)
        self.API_KEY = os.getenv("HACKATIME_API_KEY")
        self.USERNAME = os.getenv("HACKATIME_USERNAME")

        if not self.API_KEY or not self.USERNAME:
            raise RuntimeError(
                "Missing HACKATIME_API_KEY or HACKATIME_USERNAME. "
                "Create a .env in the project root (next to package.json)."
            )

        self.BASE_URL = "https://hackatime.hackclub.com/api/v1"
        self.headers = {"Authorization": f"Bearer {self.API_KEY}"}
        self.data = self.get_data("2025-12-15", "2026-3-31")
        self.total_seconds = self.data["data"]["total_seconds"]
        self.human_readable_total = self.data["data"]["human_readable_total"]
        self.total_list = self.data["data"]["languages"]
        self.projects = self.data["data"].get("projects", [])

    def get_data(self, start_date, end_date):
        # Get stats for a specific time range
        params = {
            "start": start_date,  # Start date (YYYY-MM-DD)
            "end": end_date     # End date (YYYY-MM-DD)
        }

        response = requests.get(
            f"{self.BASE_URL}/users/{self.USERNAME}/stats",
            headers=self.headers,
            params=params
        )

        data = response.json()
        return data

if __name__ == "__main__":
    import json
    req = requester()

    def _format_time(seconds: float):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        if hours > 0:
            text_val = f"{hours}h {minutes}m"
        elif minutes > 0:
            text_val = f"{minutes}m"
        else:
            text_val = f"{secs}s"
        digital = f"{hours:02d}:{minutes:02d}:{secs:02d}"
        return {
            "text": text_val,
            "hours": hours,
            "minutes": minutes,
            "digital": digital,
        }

    languages = req.total_list
    projects = req.projects
    total_seconds_all = float(req.total_seconds) if req.total_seconds else 0.0

    text_seconds = 0.0
    python_entry = None
    #kept_languages = [i for i in languages]
    kept_languages = []
    #ignore

    for lang in languages:
        name = (lang.get("name", "") or "").strip()
        if name.lower() == "text":
            text_seconds += float(lang.get("total_seconds", 0) or 0)
            continue
        if name.lower() == "python":
            python_entry = lang
        kept_languages.append(lang)

    if text_seconds > 0:
        if python_entry:
            python_seconds = float(python_entry.get("total_seconds", 0) or 0) + text_seconds
            fmt = _format_time(python_seconds)
            python_entry.update({
                "total_seconds": python_seconds,
                "text": fmt["text"],
                "hours": fmt["hours"],
                "minutes": fmt["minutes"],
                "digital": fmt["digital"],
            })
            if total_seconds_all:
                python_entry["percent"] = (python_seconds / total_seconds_all) * 100.0

        else:
            fmt = _format_time(text_seconds)
            new_py = {
                "name": "Python",
                "total_seconds": text_seconds,
                "text": fmt["text"],
                "hours": fmt["hours"],
                "minutes": fmt["minutes"],
                "digital": fmt["digital"],
            }
            if total_seconds_all:
                new_py["percent"] = (text_seconds / total_seconds_all) * 100.0
            kept_languages.append(new_py)

    # Compute per-project breakdown for accurate cookie calculation
    # Since ln(1+h) has diminishing returns, splitting by project gives more accurate total
    project_list = []
    for proj in projects:
        proj_name = proj.get("name", "") or "Unknown"
        proj_seconds = float(proj.get("total_seconds", 0) or 0)
        proj_hours = proj_seconds / 3600.0
        project_list.append({
            "name": proj_name,
            "hours": proj_hours,
            "seconds": proj_seconds
        })

    output = {
        "total_seconds": req.total_seconds,
        "human_readable": req.human_readable_total,
        "languages": kept_languages,
        "projects": project_list
    }
    
    # OPTION 1: Print to screen (Required for the Extension to work)
    print(json.dumps(output, indent=4))
    
    # OPTION 2: Save to a file (For your own debugging)
    storage_dir = os.path.join(_PROJECT_ROOT, "storage")
    os.makedirs(storage_dir, exist_ok=True)
    stats_path = os.path.join(storage_dir, "stats.json")
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=4)
