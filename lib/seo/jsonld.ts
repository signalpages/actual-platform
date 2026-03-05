export function organizationJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Actual.fyi",
        "url": "https://actual.fyi",
        "description": "Independent product audits and verification analysis for portable power stations and solar energy equipment."
    };
}

export function itemListJsonLd(title: string, items: any[]) {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": title,
        "itemListElement": items.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "url": item.url,
            "name": item.name
        }))
    };
}
