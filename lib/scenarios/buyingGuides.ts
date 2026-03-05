/**
 * Buying Guides Registry
 * Single source of truth for all scenario-guided buying guides.
 * Consumed by: /buying-guides hub, nav, and any future guide cards.
 */

export type BuyingGuideStatus = 'live' | 'coming_soon';

export interface BuyingGuide {
    id: string;
    title: string;
    subtitle: string;
    slug: string | null; // null = coming soon (no page yet)
    status: BuyingGuideStatus;
    icon: string;
    baselineCriteria: string[]; // Chip labels shown on hub card
    ctaLabel: string;
    themeColor: string;
}

export const SCENARIO_THRESHOLDS = {
    homeBackup: {
        capacityWh: 1500,
        continuousW: 2000,
        minTruthIndex: 80,
    },
    rvPower: {
        continuousW: 2000,
        minTruthIndex: 80,
        rv30aRequired: true,
        surgeDocumented: true,
    },
    apartment: {
        capacityWh: 500,
        continuousW: 600,
        minTruthIndex: 80,
    },
    cabin: {
        capacityWh: 3000,
        solarInputW: 500,
        expandableRequired: true,
        minTruthIndex: 80,
    },
    highDemand: {
        continuousW: 3000,
        surgeW: 6000,
        minTruthIndex: 80,
    },
    emergencyPower: {
        capacityWh: 1000,
        fastRechargeW: 1000,
        minTruthIndex: 80,
    },
} as const;

export const BUYING_GUIDES: BuyingGuide[] = [
    {
        id: 'home-backup',
        title: 'Home Backup',
        subtitle: 'Power your home through outages. Filters for high-capacity units capable of running refrigerators, medical devices, and multi-circuit loads.',
        slug: '/best-portable-power-stations-for-home-backup',
        status: 'live',
        icon: 'H',
        baselineCriteria: [
            `Capacity ≥${SCENARIO_THRESHOLDS.homeBackup.capacityWh}Wh`,
            `Continuous ≥${SCENARIO_THRESHOLDS.homeBackup.continuousW}W`,
            `Verification Score ≥${SCENARIO_THRESHOLDS.homeBackup.minTruthIndex}%`,
        ],
        ctaLabel: 'View Buying Guide',
        themeColor: 'bg-blue-600',
    },
    {
        id: 'rv-power',
        title: 'RV Power',
        subtitle: 'For campsite and full-hookup RV use. Prioritizes 30A compatibility, surge handling for AC soft-start, and solar recharge capacity.',
        slug: '/best-portable-power-stations-for-rv',
        status: 'live',
        icon: 'R',
        baselineCriteria: [
            `Continuous ≥${SCENARIO_THRESHOLDS.rvPower.continuousW}W`,
            'RV 30A Compatible',
            'Surge Documented',
            `Verification Score ≥${SCENARIO_THRESHOLDS.rvPower.minTruthIndex}%`,
        ],
        ctaLabel: 'View Buying Guide',
        themeColor: 'bg-emerald-600',
    },
    {
        id: 'apartment-backup',
        title: 'Apartment Backup',
        subtitle: 'Quiet, compact, and indoor-safe. For renters or small spaces needing essential outage coverage without noise or exhaust concerns.',
        slug: '/best-portable-power-stations-for-apartments',
        status: 'live',
        icon: 'A',
        baselineCriteria: [
            `Capacity ≥${SCENARIO_THRESHOLDS.apartment.capacityWh}Wh`,
            'Indoor-Safe Operation',
            'Low-Noise Inverter',
            `Verification Score ≥${SCENARIO_THRESHOLDS.apartment.minTruthIndex}%`,
        ],
        ctaLabel: 'View Buying Guide',
        themeColor: 'bg-violet-600',
    },
    {
        id: 'emergency-power',
        title: 'Emergency Power',
        subtitle: 'Short-term backup during grid outages. Filters for fast recharge, indoor-safe inverter systems, and enough capacity to keep refrigerators, lights, and communication devices running.',
        slug: '/best-portable-power-stations-for-emergency-power',
        status: 'live',
        icon: 'E',
        baselineCriteria: [
            `Capacity ≥${SCENARIO_THRESHOLDS.emergencyPower.capacityWh}Wh`,
            'Fast AC Recharge',
            'Indoor-Safe Inverter',
            `Verification Score ≥${SCENARIO_THRESHOLDS.emergencyPower.minTruthIndex}%`,
        ],
        ctaLabel: 'View Buying Guide',
        themeColor: 'bg-slate-800',
    },
    {
        id: 'off-grid-cabin',
        title: 'Off-Grid Cabin',
        subtitle: 'Multi-day self-sufficiency. Expandable systems with high solar input capacity for sustained operation far from the grid.',
        slug: '/best-portable-power-stations-for-off-grid-cabin',
        status: 'live',
        icon: 'C',
        baselineCriteria: [
            `Capacity ≥${SCENARIO_THRESHOLDS.cabin.capacityWh}Wh`,
            `Solar Input ≥${SCENARIO_THRESHOLDS.cabin.solarInputW}W`,
            'Expandable Architecture',
            `Verification Score ≥${SCENARIO_THRESHOLDS.cabin.minTruthIndex}%`,
        ],
        ctaLabel: 'View Buying Guide',
        themeColor: 'bg-orange-600',
    },
    {
        id: 'high-demand-loads',
        title: 'High-Demand Loads',
        subtitle: 'Workshop tools, well pumps, and high-draw motors. Filters for extreme surge tolerance and sustained high-watt output.',
        slug: '/best-portable-power-stations-for-high-demand',
        status: 'live',
        icon: 'D',
        baselineCriteria: [
            `Continuous ≥${SCENARIO_THRESHOLDS.highDemand.continuousW}W`,
            `Surge ≥${SCENARIO_THRESHOLDS.highDemand.surgeW}W`,
            `Verification Score ≥${SCENARIO_THRESHOLDS.highDemand.minTruthIndex}%`,
        ],
        ctaLabel: 'View Buying Guide',
        themeColor: 'bg-rose-600',
    },
];


/** Convenience: get only live guides */
export const LIVE_GUIDES = BUYING_GUIDES.filter(s => s.status === 'live');

/** Convenience: get only coming-soon guides */
export const UPCOMING_GUIDES = BUYING_GUIDES.filter(s => s.status === 'coming_soon');
