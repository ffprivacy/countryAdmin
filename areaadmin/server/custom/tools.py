def debug_print(obj, indent=0):
    indent_str = '  ' * indent
    if isinstance(obj, dict):
        print(f"{indent_str}{{")
        for key, value in obj.items():
            print(f"{indent_str}  {key}: ", end="")
            debug_print(value, indent + 1)
        print(f"{indent_str}}}")
    elif isinstance(obj, list):
        print(f"{indent_str}[")
        for value in obj:
            debug_print(value, indent + 1)
        print(f"{indent_str}]")
    elif isinstance(obj, tuple):
        print(f"{indent_str}(")
        for value in obj:
            debug_print(value, indent + 1)
        print(f"{indent_str})")
    else:
        print(f"{indent_str}{repr(obj)}")