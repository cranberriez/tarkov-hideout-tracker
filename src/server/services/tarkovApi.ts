export const TARKOV_API_USER_AGENT =
    "TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)";

export const TARKOV_API_HEADERS: HeadersInit = {
    "User-Agent": TARKOV_API_USER_AGENT,
};

export const TARKOV_GRAPHQL_HEADERS: HeadersInit = {
    ...TARKOV_API_HEADERS,
    "Content-Type": "application/json",
};
