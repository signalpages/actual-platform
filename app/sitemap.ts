import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://actual.fyi';

    // Base static routes
    const routes: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/compare`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        }
    ];

    // Fetch products
    const { data: products } = await supabase
        .from('products')
        .select('slug, category, updated_at, created_at');

    if (products) {
        // Collect unique categories for category pages
        const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

        categories.forEach((cat) => {
            routes.push({
                url: `${baseUrl}/specs?category=${cat}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.9,
            });
        });

        // Add individual product pages
        products.forEach((product) => {
            if (product.slug && product.slug !== 'null') {
                routes.push({
                    url: `${baseUrl}/specs/${product.slug}`,
                    lastModified: product.updated_at ? new Date(product.updated_at) : new Date(product.created_at || new Date()),
                    changeFrequency: 'weekly',
                    priority: 0.8,
                });
            }
        });
    }

    return routes;
}
