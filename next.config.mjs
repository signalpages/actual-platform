/** @type {import('next').NextConfig} */

import { execSync } from 'child_process';

let buildId = 'dev';
try {
    buildId = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
    buildId = `dev-${Date.now()}`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    env: {
        NEXT_PUBLIC_BUILD_ID: buildId,
    },
    async redirects() {
        return [
            {
                source: "/product/:slug*",
                destination: "/specs/:slug*",
                permanent: true,
            },
            {
                source: "/products/:slug*",
                destination: "/specs/:slug*",
                permanent: true,
            },
        ];
    },
    // Ensure no static export is forced, adhering to Cloudflare Pages Functions requirements
};

export default nextConfig;
