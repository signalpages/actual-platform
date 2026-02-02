/**
 * Backfill script to reclassify all products from generic "solar" 
 * into specific V1 categories using deterministic rules.
 * 
 * Run with: npx tsx scripts/backfillCategories.ts
 */

import { createClient } from '@supabase/supabase-js';
import { categorizeProduct, isValidCategory } from '../lib/categorizeProduct';
import { Product, ProductCategory } from '../types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillCategories() {
    console.log('🔄 Starting category backfill...\n');

    // 1. Fetch all products
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('❌ Error fetching products:', error);
        process.exit(1);
    }

    if (!products || products.length === 0) {
        console.log('✅ No products found to backfill');
        return;
    }

    console.log(`📦 Found ${products.length} products\n`);

    const stats: Record<string, number> = {};
    const updates: Array<{ id: string; old: string; new: ProductCategory }> = [];

    // 2. Categorize each product
    for (const product of products as Product[]) {
        const currentCategory = product.category;
        const newCategory = categorizeProduct(product.model_name, product.brand);

        // Track stats
        stats[newCategory] = (stats[newCategory] || 0) + 1;

        // Only update if category changed
        if (currentCategory !== newCategory) {
            updates.push({
                id: product.id,
                old: currentCategory,
                new: newCategory
            });
        }
    }

    console.log('📊 Category distribution:\n');
    Object.entries(stats)
        .sort(([, a], [, b]) => b - a)
        .forEach(([category, count]) => {
            console.log(`   ${category.padEnd(30)} ${count}`);
        });

    console.log(`\n📝 Products requiring update: ${updates.length}\n`);

    if (updates.length === 0) {
        console.log('✅ All products already correctly categorized!');
        return;
    }

    // 3. Show preview of changes
    console.log('Preview of changes:\n');
    updates.slice(0, 10).forEach(({ id, old, new: newCat }) => {
        const product = products.find(p => p.id === id);
        console.log(`   ${product?.brand} ${product?.model_name}`);
        console.log(`   ${old} → ${newCat}\n`);
    });

    if (updates.length > 10) {
        console.log(`   ... and ${updates.length - 10} more\n`);
    }

    // 4. Apply updates
    console.log('🚀 Applying updates...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const { id, new: newCategory } of updates) {
        const { error } = await supabase
            .from('products')
            .update({ category: newCategory })
            .eq('id', id);

        if (error) {
            console.error(`❌ Failed to update ${id}:`, error.message);
            errorCount++;
        } else {
            successCount++;
        }
    }

    console.log('\n📈 Results:');
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (successCount > 0) {
        console.log('\n✅ Category backfill complete!');
    }
}

// Run the backfill
backfillCategories().catch(console.error);
