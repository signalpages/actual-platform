/**
 * Decision Surfaces Registry
 * Single source of truth for all scenario-guided decision surfaces.
 * Consumed by: /decision-surfaces hub, nav, and any future surface cards.
 */

export type DecisionSurfaceStatus = 'live' | 'coming_soon';

export interface DecisionSurface {
    id: string;
    title: string;
    subtitle: string;
    slug: string | null; // null = coming soon (no page yet)
    status: DecisionSurfaceStatus;
    icon: string;
    baselineCriteria: string[]; // Chip labels shown on hub card
    ctaLabel: string;
}

export const DECISION_SURFACES: DecisionSurface[] = [
    {
        id: 'home-backup',
        title: 'Home Backup',
        subtitle: 'Power your home through outages. Filters for high-capacity units capable of running refrigerators, medical devices, and multi-circuit loads.',
        slug: '/best-portable-power-stations-for-home-backup',
        status: 'live',
        icon: 'H',
        baselineCriteria: [
            'Capacity ≥1500Wh',
            'Continuous ≥2000W',
            'Truth Index ≥80%',
        ],
        ctaLabel: 'View Buying Guide',
    },
    {
        id: 'rv-power',
        title: 'RV Power',
        subtitle: 'For campsite and full-hookup RV use. Prioritizes 30A compatibility, surge handling for AC soft-start, and solar recharge capacity.',
        slug: '/best-portable-power-stations-for-rv',
        status: 'live',
        icon: 'R',
        baselineCriteria: [
            'Continuous ≥2000W',
            'RV 30A Compatible',
            'Surge Documented',
            'Truth Index ≥80%',
        ],
        ctaLabel: 'View Buying Guide',
    },
    {
        id: 'apartment-backup',
        title: 'Apartment Backup',
        subtitle: 'Quiet, compact, and indoor-safe. For renters or small spaces needing essential outage coverage without noise or exhaust concerns.',
        slug: null,
        status: 'coming_soon',
        icon: 'A',
        baselineCriteria: [
            'Capacity ≥500Wh',
            'Indoor-Safe Operation',
            'Low-Noise Inverter',
            'Truth Index ≥80%',
        ],
        ctaLabel: 'Coming Soon',
    },
    {
        id: 'off-grid-cabin',
        title: 'Off-Grid Cabin',
        subtitle: 'Multi-day self-sufficiency. Expandable systems with high solar input capacity for sustained operation far from the grid.',
        slug: null,
        status: 'coming_soon',
        icon: 'C',
        baselineCriteria: [
            'Capacity ≥3000Wh',
            'Solar Input ≥500W',
            'Expandable Architecture',
            'Truth Index ≥80%',
        ],
        ctaLabel: 'Coming Soon',
    },
    {
        id: 'high-demand-loads',
        title: 'High-Demand Loads',
        subtitle: 'Workshop tools, well pumps, and high-draw motors. Filters for extreme surge tolerance and sustained high-watt output.',
        slug: null,
        status: 'coming_soon',
        icon: 'D',
        baselineCriteria: [
            'Continuous ≥3000W',
            'Surge ≥6000W',
            'Truth Index ≥80%',
        ],
        ctaLabel: 'Coming Soon',
    },
];

/** Convenience: get only live surfaces */
export const LIVE_SURFACES = DECISION_SURFACES.filter(s => s.status === 'live');

/** Convenience: get only coming-soon surfaces */
export const UPCOMING_SURFACES = DECISION_SURFACES.filter(s => s.status === 'coming_soon');
