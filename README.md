# Flavourtown Time Tracking (VS Code Extension)

Shows your daily coding stats and progress toward your target item.

## Setup
1) set up Hackatime api

log in to [Hackatime settings](https://hackatime.hackclub.com/my/settings)
 ,then go to setup time tracking![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/hackatime_api_demo1.png)

then look for your api key and copy it to a safe place![alt text](hackatime_api_demo2.png)

2) set up Hackatime Username

log in to [Hackatime settings](https://hackatime.hackclub.com/my/settings)

then copy your Username, or set one up if you havent (don't forget to press save!!!)![alt text](hackatime_username_demo.png)

3) set up Flavourtown api

log in to your flavourtown account and go to setting ![alt text](ft_api_demo1.png)

look for your API key![alt text](ft_api_demo2.png)

copy it to a save place![alt text](ft_api_demo3.png)

4) install the extension

go to your vscode's sidebar and look for extension, then search for Flavourtown-sidebar, then press install

5) set up extension
press on the gear icon![alt text](ide_demo1.png)
paste your apis![alt text](ide_demo2.png)
enter your Hackatime Username![alt text](ide_demo3.png)
press refresh![alt text](ide_demo4.png)
dont forget to set your target!!!![alt text](ide_demo5.png)
Congradulations!!! You are all set!

## Troubleshooting
- If data is empty: ensure Python is installed and the API key/username are set; run `python python_scripts/get_data.py` to see errors.
- If prices are missing: run `python python_scripts/get_targets.py` to refresh `storage/ft_store.json`.

## Privacy
API tokens are stored in your VS Code user settings and sent only to Hackatime/Flavourtown to fetch your data. Remove keys from settings to revoke access.