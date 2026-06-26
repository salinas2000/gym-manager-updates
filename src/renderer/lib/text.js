// Text helpers for accent/case-insensitive search across the app.
//
// Spanish users expect "jose" to match "José", "munoz" to match "Muñoz", etc.
// normalizeText strips diacritics (NFD + combining-marks removal) and lowercases,
// so searches ignore tildes/accents. Use it on BOTH the query and the field.

export function normalizeText(value) {
    return (value ?? '')
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
        .toLowerCase()
        .trim();
}

// Convenience: does `haystack` contain `needle`, ignoring case AND accents?
export function textIncludes(haystack, needle) {
    return normalizeText(haystack).includes(normalizeText(needle));
}
