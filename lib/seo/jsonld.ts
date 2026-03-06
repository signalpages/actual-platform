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

export function generateItemList(name: string, urls: string[]) {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        "itemListElement": urls.map((url, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
                "@type": "Product",
                url
            }
        }))
    };
}
