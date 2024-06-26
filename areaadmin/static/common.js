function IS_LOCAL_AREA_REGEX(uri) {
    return uri.match(/^[ \t]*\d+[ \t]*$/) != null;
}
function HOME_HOST_URI() {
    return URL.parse(document.location.origin).origin;
}
function area_api_generate_from_database(uri=undefined) {
    if ( uri == undefined ) {
        if ( AREA_DATA != undefined && AREA_DATA['area_id'] != undefined ) {
            uri = `${AREA_DATA['area_id']}`;
        } else {
            throw "Must provide uri or loadVars";
        }
    }
    if ( IS_LOCAL_AREA_REGEX(uri) ) {
        return `/api/area/${parseInt(uri)}`;
    } else {
        return `${uri}${uri.endsWith("/") ? "" : "/"}api`;
    } 
}
function dashboard_area_generate_uri_from_database(o) {
    let uri = "";
    let path = "dashboard"
    let area_id = null;
    
    if ( typeof(o) === typeof("") ) {
        if ( IS_LOCAL_AREA_REGEX(o) ) {
            area_id = parseInt(o)
        } else {
            uri = o
        }
    } else if (typeof(o) === typeof({})) {
        
        area_id = o.remote_area_id;
        if ( o.remote_host_uri ) {
            uri = o.remote_host_uri;
        }

    } else {
        throw "Missing arg"
    }

    if ( area_id != null ) {
        path = `area/${area_id}/dashboard`;
    }
    return `${uri}${uri.endsWith("/") ? "" : "/"}${path}`;

}
function JSON_parse(response) {
	return response.text().then(text => {
        return JSON.parse(text, (key, value) => {
            if (value === "Infinity") return Infinity;
            if (value === "-Infinity") return -Infinity;
            if (value === "NaN") return NaN;
            return value;
        });
    });
}
/**
 * Query on the API endpoint of the selected API.
 */
function fetchAreaAPI(path="", parameters=undefined, uri=undefined) {
    const area_uri = area_api_generate_from_database(uri);
    if ( parameters == undefined ) {
        parameters = {};
    }
    if ( parameters['headers'] == undefined ) {
        parameters['headers'] = {};
    }
    if ( parameters['method'] == undefined ) {
        parameters['method'] = 'GET';
    }
    parameters['headers']['Content-Type'] = 'application/json';
    parameters['headers']['Authorization'] = 'Bearer your_access_token';
    return fetch(`${area_uri}${area_uri.endsWith("/") || path.startsWith("/") ? "" : "/"}${path}`, parameters).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return JSON_parse(response);
    });
}