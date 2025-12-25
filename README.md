# Flavourtown Time Tracking (VS Code Extension)

Shows your daily coding stats and progress toward your target item.

## Python & Requirements

1. [Install Python](https://www.python.org/downloads/)
2. Requirements auto-install: the extension now installs packages from `requirements.txt` automatically the first time it runs. If you prefer to preinstall manually:

```bash
pip install -r requirements.txt
```

### Choosing the Python interpreter

- In VS Code Settings, set `Flavourtown: Python Path` (`flavourtown.pythonPath`) to the absolute path of your Python executable. This is **required** if you use a virtual environment (venv) or if the extension cannot find `python` automatically.
- Example paths:
  - Windows: `C:\Users\You\Envs\env\Scripts\python.exe`
  - Linux/Mac: `/home/you/env/bin/python`
- If not set, the extension attempts to use the system `python` or `python3` command, which may not have the required packages if you installed them in a venv.
- On Windows, a reliable manual install is:

```powershell
py -3 -m pip install -r requirements.txt
```

## Setup

1. set up Hackatime api

log in to [Hackatime settings](https://hackatime.hackclub.com/my/settings)
,then go to setup time tracking![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/hackatime_api_demo1.png)

then look for your api key and copy it to a safe place![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/hackatime_api_demo2.png)

2. set up Hackatime Username

log in to [Hackatime settings](https://hackatime.hackclub.com/my/settings)

then copy your Username, or set one up if you havent (don't forget to press save!!!)![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/hackatime_username_demo.png)

3. set up Flavourtown api

log in to your flavourtown account and go to setting ![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/ft_api_demo1.png)

look for your API key![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/ft_api_demo2.png)

copy it to a save place![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/ft_api_demo3.png)

4. install the extension

go to your vscode's sidebar and look for extension, then search for Flavourtown-sidebar, then press install

5. set up extension
   press on the gear icon![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/ide_demo1.png)
   paste your apis![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/ide_demo2.png)
   enter your Hackatime Username![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/ide_demo3.png)
   press refresh![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/ide_demo4.png)
   dont forget to set your target!!!![alt text](https://raw.githubusercontent.com/jasonw-w/FT_cookietracker/main/ide_demo5.png)
   Congradulations!!! You are all set!

## Troubleshooting

- If data is empty: ensure Python is installed and the API key/username are set; run `python python_scripts/get_data.py` to see errors. If you use a venv, set the `Flavourtown: Python Path` setting to your venv's python.
- If prices are missing: run `python python_scripts/get_targets.py` to refresh `storage/ft_store.json`.

## Privacy

API tokens are stored in your VS Code user settings and sent only to Hackatime/Flavourtown to fetch your data. Remove keys from settings to revoke access.

## Settings

| Setting         | Required | Description                                                   |
| --------------- | -------- | ------------------------------------------------------------- |
| hackatime_api   | Yes      | Hackatime API token used to fetch stats.                      |
| username        | Yes      | Hackatime username for the stats fetch.                       |
| flavourtown_api | Optional | Flavourtown API token to fetch store data and pricing.        |
| storeItem       | Optional | Store item name to track; set via the picker command.         |
| country         | Optional | Pricing region code (au, ca, eu, in, uk, us, xx).             |
| quality         | Optional | Quality factor (1-15, default 10) used in the cookie formula. |
| k               | Optional | Advanced exponent k in the cookie formula (default 4).        |
| beta            | Optional | Advanced beta factor in the cookie formula (default 2).       |
| pythonPath      | Optional | Absolute path to the Python interpreter (e.g. inside a venv). |

Settings live in VS Code user settings. Env fallbacks (if set): HACKATIME_API_KEY, HACKATIME_USERNAME, FT_API_KEY.

## Cookie Formula

The extension predicts earned cookies using:

$$c(h, q) = 88 \cdot \left(\frac{q}{15}\right)^k \cdot (1 + \beta \ln(1 + h))$$

Where:

- $h$ = hours coded today
- $q$ = quality factor (1-15)
- $k$ = exponent (default 1)
- $\beta$ = beta factor (default 2)
