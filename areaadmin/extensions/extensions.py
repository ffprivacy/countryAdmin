import argparse
import importlib
import sys
import requests

def process_import(process):
    endpoint_url = 'http://127.0.0.1:5000/api/set_process'
    headers = {'Content-Type': 'application/json'}
    
    response = requests.post(endpoint_url, json=process, headers=headers)
    if response.status_code == 200:
        print("Successfully imported:", process['title'])
    else:
        print("Failed to import:", process['title'], response.text)

def list_modules():
    available_modules = {
        'lowtechlab': 'https://wiki.lowtechlab.org/wiki/Explore',
    }
    print("Available modules:")
    for module, description in available_modules.items():
        print(f"{module}: {description}")

def main():
    parser = argparse.ArgumentParser(description="AreaAdmin extensions")
    parser.add_argument('command', help='Command to execute')
    parser.add_argument('module', nargs='?', help='Name of the module')
    
    args = parser.parse_args()

    command = args.command

    if command == "import":
        try:
            module = importlib.import_module(args.module)
        except ImportError:
            print(f"Module '{args.module}' not found")
            sys.exit(1)
        try:
            extension_get_processes = getattr(module, "extension_get_processes")
        except AttributeError:
            print(f"Function '{args.extension_get_processes}' not found in module '{args.module}'")
            sys.exit(1)
        
        processes = extension_get_processes()
        for process in processes:
            process_import(process)

    elif command == "list":
        list_modules()
    else:
        print("""
            list
            help
            import <module>
        """)

if __name__ == "__main__":
    main()
