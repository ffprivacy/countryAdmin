function IS_LOCAL_AREA_REGEX(uri) {
    return uri.match(/^[ \t]*\d+[ \t]*$/) != null;
}
function area_generate_uri_from_database(uri) {
    if ( IS_LOCAL_AREA_REGEX(uri) ) {
        return `/api/area/${parseInt(uri)}`;
    } else {
        return `${uri}${uri.endsWith("/") ? "" : "/"}api/area`;
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
        path = `area/${parseInt(uri)}/dashboard`;
    }
    return `${uri}${uri.endsWith("/") ? "" : "/"}${path}`;

}