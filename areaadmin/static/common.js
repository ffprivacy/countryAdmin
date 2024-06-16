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