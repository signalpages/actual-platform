import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Best Power Stations for Home Backup (2000W+) | Actual.fyi',
    description: 'Independent analysis of portable power stations for home backup. Filters by continuous output (2000W+), capacity, and verified Truth Index.',
    alternates: {
        canonical: '/best-portable-power-stations-for-home-backup',
    },
};

export default function HomeBackupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
