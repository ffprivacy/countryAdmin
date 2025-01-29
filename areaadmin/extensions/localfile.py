import requests, json
import sys

def extension_get_processes(*args):
    if len(args) == 0:
        print("Need to provide file as arg")
        sys.exit(1)

    processes = []
    for file_path in args:

        print(f"Adding: {file_path}")

        with open(file_path, 'r') as file:
            data = file.read()
            result = json.loads(data)
            if isinstance(result, dict):
                processes.append(result)
            elif isinstance(result, list):
                processes.extend(result)
            else:
                raise("Unknown while parsing")

    return processes

def extension_display_help():
    print("")