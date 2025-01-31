import argparse
import importlib
import sys
import requests

def process_import(process):
    endpoint_url = 'http://127.0.0.1:5000/api/set_process'
    headers = {'Content-Type': 'application/json', 'Authorization': 'Bearer admin'}
    
    response = requests.post(endpoint_url, json=process, headers=headers)
    if response.status_code == 200:
        print("Successfully imported:", process['title'])
    else:
        print("Failed to import:", process['title'], response.text)

def list_modules():
    available_modules = {
        'lowtechlab': 'https://wiki.lowtechlab.org/wiki/Explore',
        'localfile': '',
        'lafabriquediy': 'http://www.lafabriquediy.com/'
    }
    print("Available modules:")
    for module, description in available_modules.items():
        print(f"{module}: {description}")

def display_help():
    print("""
            list
            help [module]
            exec <module> [args]
        """)

def main():
    parser = argparse.ArgumentParser(description="AreaAdmin extensions")
    parser.add_argument('command', help='Command to execute')
    parser.add_argument('module', nargs='?', help='Name of the module')
    
    args, unknown_args = parser.parse_known_args()

    command = args.command
    module = None
    if args.module is not None:
        modName = f"areaadmin.extensions.{args.module}" 
        try:
            module = importlib.import_module(modName)
        except ImportError:
            print(f"Module '{args.module}' not found")
            sys.exit(1)

    if command == "exec":    
        try:
            extension_get_processes = getattr(module, "extension_get_processes")
        except AttributeError:
            print(f"Function '{args.extension_get_processes}' not found in module '{args.module}'")
            sys.exit(1)
        
        processes = extension_get_processes(*sys.argv[3:])
        for process in processes:
            process_import(process)

    elif command == "list":
        list_modules()
    elif command == "help":
        if module is None:
            display_help()
        else:
            try:
                extension_display_help = getattr(module, "extension_display_help")
            except AttributeError:
                print(f"Function '{args.extension_display_help}' not found in module '{args.module}'")
                sys.exit(1)
            extension_display_help()
    else:
        display_help()

if __name__ == "__main__":
    main()
