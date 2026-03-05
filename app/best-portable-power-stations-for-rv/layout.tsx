import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Best Power Stations for RV Use (30A Compatible) | Actual.fyi',
    description: 'Independent analysis of portable power stations suitable for RV use. Filters by 30A compatibility, surge handling, and verified Truth Index.',
    alternates: {
        canonical: '/best-portable-power-stations-for-rv',
    },
};

export default function RVPowerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
