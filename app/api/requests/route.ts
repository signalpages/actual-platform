import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function ok() {
    return NextResponse.json({ ok: true }, { status: 200 });
}

function bad(msg: string, status = 400) {
    return NextResponse.json({ ok: false, error: msg }, { status });
}

function str(v: any) {
    return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
    try {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
            return bad("Database configuration missing", 500);
        }

        const body = await req.json();

        // 1) Honeypot: bots fill this out, humans don't
        if (body.company_website) return ok(); // silently absorb

        // 2) Time-based honeypot: submitted too fast
        const loadedAt = Number(body.form_loaded_at || 0);
        if (loadedAt && Date.now() - loadedAt < 3000) return ok(); // silently absorb

        // 3) Extract fields
        const manufacturer = str(body.manufacturer);
        const model = str(body.model);
        const category = str(body.category);
        const productUrl = str(body.url);

        if (!manufacturer || !model || !category) {
            return bad("Missing required fields");
        }

        // 4) Caps & Length Constraints
        if (manufacturer.length > 120) return bad("Manufacturer too long");
        if (model.length > 120) return bad("Model too long");
        if (category.length > 120) return bad("Category too long");
        if (productUrl.length > 800) return bad("URL too long");

        const supabase = createClient(url, key, { auth: { persistSession: false } });

        // 5) Check for existing request to increment count
        const { data: existing, error: fetchError } = await supabase
            .from('coverage_requests')
            .select('id, request_count')
            .ilike('manufacturer', manufacturer) // use the trimmed versions directly
            .ilike('model', model)
            .maybeSingle();

        if (fetchError) {
            console.error("Error checking existing request:", fetchError);
            return bad("Database query failed", 500);
        }

        let actionType = "New Submission";
        let currentCount = 1;

        if (existing) {
            // Increment
            currentCount = existing.request_count + 1;
            actionType = `Upvote (Count: ${currentCount})`;
            const { error: updateError } = await supabase
                .from('coverage_requests')
                .update({
                    request_count: currentCount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (updateError) throw updateError;
        } else {
            // Insert
            const { error: insertError } = await supabase
                .from('coverage_requests')
                .insert({
                    manufacturer: manufacturer,
                    model: model,
                    category,
                    url: productUrl || null,
                    request_count: 1,
                    status: 'pending'
                });

            if (insertError) throw insertError;
        }

        // 6) Discord Notification
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
            const ip = req.headers.get("x-forwarded-for") || "";
            const message = `**[Coverage Request]** ${actionType}\n**Product:** ${manufacturer} ${model}\n**Category:** ${category}${productUrl ? `\n**URL:** <${productUrl}>` : ""}\n**IP:** ${ip}`;

            // Fire-and-forget Discord ping
            fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: message })
            }).catch(e => console.error("Discord webhook failed", e));
        }

        return ok();

    } catch (err: any) {
        console.error("Coverage Request API Error:", err);
        return bad("Internal Server Error", 500);
    }
}
