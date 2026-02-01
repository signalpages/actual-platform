import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // TODO: Route to Cloudflare Worker endpoint
        // For now, just log and return success
        console.log('Contact form submission:', message);

        // In production, forward to Cloudflare Worker:
        // const workerResponse = await fetch('https://your-worker.workers.dev/contact', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ message, timestamp: new Date().toISOString() })
        // });

        return NextResponse.json({
            success: true,
            message: 'Submission received'
        });

    } catch (error) {
        console.error('Contact API error:', error);
        return NextResponse.json(
            { error: 'Submission failed' },
            { status: 500 }
        );
    }
}
