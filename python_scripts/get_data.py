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
        self.data = self.get_data("2025-12-22", time.strftime("%Y-%m-%d"))
        self.total_seconds = self.data["data"]["total_seconds"]
        self.human_readable_total = self.data["data"]["human_readable_total"]
        self.total_list = self.data["data"]["languages"]

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
    output = {
        "total_seconds": req.total_seconds,
        "human_readable": req.human_readable_total,
        "languages": req.total_list
    }
    
    # OPTION 1: Print to screen (Required for the Extension to work)
    print(json.dumps(output, indent=4))
    
    # OPTION 2: Save to a file (For your own debugging)
    storage_dir = os.path.join(_PROJECT_ROOT, "storage")
    os.makedirs(storage_dir, exist_ok=True)
    stats_path = os.path.join(storage_dir, "stats.json")
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=4)
