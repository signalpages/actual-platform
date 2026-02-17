export type UiMode = 'a' | 'b' | 'c' | null;

export function getUiMode(searchParams: URLSearchParams | null): UiMode {
    if (!searchParams) return null;
    const ui = searchParams.get('ui');
    if (ui === 'a' || ui === 'b' || ui === 'c') return ui;
    return null;
}

export function withUi(href: string, mode: UiMode): string {
    if (!mode) return href;

    // Handle hash links or existing params
    const [path, hash] = href.split('#');
    const hasQuery = path.includes('?');
    const separator = hasQuery ? '&' : '?';

    const newPath = `${path}${separator}ui=${mode}`;
    return hash ? `${newPath}#${hash}` : newPath;
}
