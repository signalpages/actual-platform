import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { ProductAudit } from '@/types';

export function useProductAudit(productId: string | undefined) {
    const [audits, setAudits] = useState<Record<string, ProductAudit>>({});

    // Initialize Supabase client inside the hook or component context
    // Ideally it should be outside if it's singleton, but `createBrowserClient` creates a singleton.
    const supabase = createBrowserClient();

    useEffect(() => {
        if (!productId) return;

        // Initial fetch
        const fetchInitial = async () => {
            const { data } = await supabase
                .from('product_audits')
                .select('*')
                .eq('product_id', productId);

            if (data) {
                const map: Record<string, ProductAudit> = {};
                data.forEach((row: ProductAudit) => {
                    map[row.field_name] = row;
                });
                setAudits(map);
            }
        };

        fetchInitial();

        // Realtime subscription
        const channel = supabase
            .channel('audit-updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'product_audits',
                    filter: `product_id=eq.${productId}`
                },
                (payload) => {
                    const newRow = payload.new as ProductAudit;
                    setAudits((prev) => ({
                        ...prev,
                        [newRow.field_name]: newRow
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [productId]);

    return { audits };
}
