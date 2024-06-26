function IS_LOCAL_AREA_REGEX(uri) {
    return uri.match(/^[ \t]*\d+[ \t]*$/) != null;
}
function HOME_HOST_URI() {
    return URL.parse(document.location.origin).origin;
}
function area_dashboard_url(area) {
    let uri = "";
    let path = "dashboard"
    let area_id = null;
    
    if (typeof(area) === typeof({})) {

        area_id = area.id;
        if ( area.uri ) {
            uri = area.uri;
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
function area_api_url(area={}) {
    let uri = area.uri;
    let id = area.id;
    if ( uri == undefined ) {
        if ( id == undefined ) {
            if ( AREA_DATA != undefined && AREA_DATA['area_id'] != undefined ) {
                id = `${AREA_DATA['area_id']}`;
            } else {
                throw "Must provide uri or loadVars";
            }
        }
        uri = "";
    } else {
        if ( id == undefined ) {
            id = 1;
        }
    }
    return `${uri}${uri.endsWith("/") ? "" : "/"}api/area/${id}/`;
}
/**
 * Query on the API endpoint of the selected API.
 */
function fetchAreaAPI(path="", parameters=undefined, area={}) {

    const area_api = area_api_url(area);

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
    if ( path.startsWith("/") && area_api.endsWith("/") ) {
        path = path.substring(1);
    }
    return fetch(`${area_api}${path}`, parameters).then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return JSON_parse(response);
    });
}