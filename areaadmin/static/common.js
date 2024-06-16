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
function dashboard_area_generate_uri_from_database(uri) {
    if ( IS_LOCAL_AREA_REGEX(uri) ) {
        return `/area/${parseInt(uri)}/dashboard`;
    } else {
        return `${uri}${uri.endsWith("/") ? "" : "/"}dashboard`;
    }
}