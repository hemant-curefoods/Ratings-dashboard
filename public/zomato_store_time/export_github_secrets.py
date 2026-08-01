import json
import os
import sys

def main():
    service_account_file = "zomato_store_timing.json"
    cookies_file = "cookies.json"

    print("=" * 60)
    print("GITHUB SECRETS EXPORT TOOL")
    print("=" * 60 + "\n")

    # 1. Google Service Account JSON
    try:
        with open(service_account_file, "r") as f:
            sa_data = json.load(f)
            sa_str = json.dumps(sa_data, separators=(",", ":"))
            print("1. GOOGLE_SERVICE_ACCOUNT_JSON")
            print("-" * 30)
            print("Copy the line below into your GitHub Secret:")
            print(sa_str)
            print("\n")
    except Exception as e:
        print(f"❌ Error reading {service_account_file}: {e}\n")

    # 2. Zomato Cookies JSON
    try:
        with open(cookies_file, "r") as f:
            cookie_data = json.load(f)
            cookie_str = json.dumps(cookie_data, separators=(",", ":"))
            print("2. ZOMATO_COOKIES_JSON")
            print("-" * 30)
            print("Copy the line below into your GitHub Secret:")
            print(cookie_str)
            print("\n")
    except Exception as e:
        print(f"❌ Error reading {cookies_file}: {e}")
        print("Please run 'python login_export.py' first to generate fresh cookies.\n")

    print("=" * 60)
    print("Next steps:")
    print("1. Go to your GitHub Repository -> Settings -> Secrets and variables -> Actions")
    print("2. Click 'New repository secret'")
    print("3. Add the secrets exactly as shown above, along with SHEET_ID, VISIBLE_TAB, and HIDDEN_TAB.")

if __name__ == "__main__":
    main()
