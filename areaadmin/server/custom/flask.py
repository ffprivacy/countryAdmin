import flask

def jsonify(data):
    def replace_special_floats(obj):
        if isinstance(obj, float):
            if obj == float('inf'):
                return "Infinity"
            elif obj == float('-inf'):
                return "-Infinity"
            elif obj != obj: 
                return "NaN"
        return obj

    def recursive_replace(data):
        if isinstance(data, dict):
            return {k: recursive_replace(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [recursive_replace(item) for item in data]
        else:
            return replace_special_floats(data)

    processed_data = recursive_replace(data)
    return flask.jsonify(processed_data)