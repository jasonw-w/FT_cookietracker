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
        self.API_KEY = os.getenv("FT_API_KEY")

        if not self.API_KEY:
            raise RuntimeError(
                "Missing HACKATIME_API_KEY or HACKATIME_USERNAME. "
                "Create a .env in the project root (next to package.json)."
            )

        self.BASE_URL = "https://flavortown.hackclub.com/api/v1"

    def get_data(self):
        # Get stats for a specific time range
        response = requests.get(
            f"{self.BASE_URL}/store",
            headers={"Authorization": f"Bearer {self.API_KEY}"},
        )

        data = response.json()
        return data

if __name__ == "__main__":
    import json
    req = requester()
    data = req.get_data()

    items = [
        i for i in data["items"]
        if "accessory" not in str(i.get("type", "")).lower()
    ]
    data["items"] = sorted(items, key=lambda item: float(item["ticket_cost"]["base_cost"]))
    output = {
        "item_names" : [i["name"] for i in data["items"]],
        "enabled_items" : [{"name": i["name"], "enabled": i["enabled"]} for i in data["items"]],
        "ticket_costs" : [{"name": i["name"], "cost": i["ticket_cost"]} for i in data["items"]],
        "raw_data": data
    }
    with open (os.path.join(_PROJECT_ROOT, "storage", "ft_store.json"), "w", encoding="utf-8") as f:
        json.dump(output, f, indent=4)

