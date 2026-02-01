import React from 'react';
import './globals.css';
import Layout from '@/components/Layout';
import { Inter } from 'next/font/google';

const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800', '900'],
    variable: '--font-inter',
    display: 'swap',
});

export const metadata = {
    metadataBase: new URL(
        process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://actual-fyi.vercel.app'
    ),
    title: 'Actual.fyi | Forensic Power Station Audits',
    description: 'Technical integrity verified against real-world discharge tests.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={`${inter.variable} bg-white min-h-screen text-slate-900 selection:bg-blue-100 selection:text-blue-900 font-sans`}>
                <Layout>{children}</Layout>
            </body>
        </html>
    );
}
