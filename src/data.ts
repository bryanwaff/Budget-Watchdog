export interface BudgetMetadata {
  county: string;
  year: string;
  total_estimate: string;
  own_source_revenue: string;
  equitable_share: string;
  recurrent_expenditure: string;
  development_expenditure: string;
  recurrent_percent?: string;
  development_percent?: string;
}

export interface Ward {
  id: string;
  name: string;
  projects: string[];
}

export interface County {
  id: string;
  name: string;
  flagEmoji: string;
  metadata: BudgetMetadata;
  wards: Ward[];
  fileName: string;
  fileSize: string;
}

export const COUNTIES: County[] = [
  {
    id: "lamu",
    name: "Lamu County Budget",
    flagEmoji: "🏝️",
    fileName: "Lamu County Programme Based Budget 2024-2025.pdf",
    fileSize: "3.55 MB",
    metadata: {
      county: "Lamu",
      year: "2024/2025",
      total_estimate: "5,288,777,353",
      own_source_revenue: "290,000,000",
      equitable_share: "3,362,798,128",
      recurrent_expenditure: "3,082,742,867 (58%)",
      development_expenditure: "2,206,034,486 (42%)",
      recurrent_percent: "58%",
      development_percent: "42%"
    },
    wards: [
      { id: 'kiunga', name: 'Kiunga Ward', projects: ['Household Water Connections', 'Desalination Plant', 'Kiunga Health Facility Upgrade'] },
      { id: 'faza', name: 'Faza Ward', projects: ['Ice Plant Revival', 'Siyu Household Connections', 'Faza Sea Wall Restoration'] },
      { id: 'witu', name: 'Witu Ward', projects: ['Water Pan Construction', 'Flood Disaster Relief', 'Witu Cattle Dip Rehab'] },
      { id: 'hindi', name: 'Hindi Ward', projects: ['Market Paving (Cabro)', 'Road Maintenance', 'Hindi Dispensary Expansion'] },
      { id: 'mpeketoni', name: 'Mpeketoni Ward', projects: ['Market Completion', 'Agriculture Field Day', 'Town Sewer Line Phase I'] },
      { id: 'shella', name: 'Shella Ward', projects: ['Manda Yawi-Raskitau Water Project', 'Jetty Rehabilitation', 'Sea Wave Breakers'] },
    ]
  },
  {
    id: "nairobi",
    name: "Nairobi City Budget",
    flagEmoji: "🏙️",
    fileName: "NAIROBI-CITY-COUNTY-SUPPLEMENTARY-II-EXPENDITURE-AND-REVENUE-ESTIMATES-FOR-FY-2024-2025.pdf",
    fileSize: "3.54 MB",
    metadata: {
      county: "Nairobi",
      year: "2024/2025 (Supp II)",
      total_estimate: "43,564,321,200",
      own_source_revenue: "20,011,540,000",
      equitable_share: "20,578,131,010",
      recurrent_expenditure: "31,438,206,120 (72%)",
      development_expenditure: "12,126,115,080 (28%)",
      recurrent_percent: "72%",
      development_percent: "28%"
    },
    wards: [
      { id: 'kilimani', name: 'Kilimani Ward', projects: ['Ring Road Kilimani Drainage', 'Kilimani ICT Hub', 'Kilimani Primary School Upgrades'] },
      { id: 'kitisuru', name: 'Kitisuru Ward', projects: ['Kihumbuini Sports Ground', 'Mbagathi Way Link Cabro', 'Kitisuru Dispensary Renovation'] },
      { id: 'parklands', name: 'Parklands Ward', projects: ['Highridge Market Re-modelling', 'First Parklands Ave Sewer Repair', 'Parklands Ridge Water Borehole'] },
      { id: 'karen', name: 'Karen Ward', projects: ['Karen Road Widening & Paving', 'Karen Clean Water Distribution', 'Bomas Eco-Tourism Support'] },
      { id: 'south_c', name: 'South C Ward', projects: ['South C Ward Flood-Mitigation Channels', 'South C Clinic Expansion', 'South C Police Post Security Cameras'] },
      { id: 'central', name: 'Nairobi Central CBD', projects: ['CBD Waste Collection Bin Installation', 'Tom Mboya Street Streetlighting', 'Central Station Security Upgrade'] },
    ]
  },
  {
    id: "projects",
    name: "Projects Inventory",
    flagEmoji: "📋",
    fileName: "List of Projects FY 2025-2026.pdf",
    fileSize: "7.73 MB",
    metadata: {
      county: "Projects Inventory",
      year: "FY 2025/2026",
      total_estimate: "15,830,450,000",
      own_source_revenue: "4,120,000,000",
      equitable_share: "11,710,450,000",
      recurrent_expenditure: "6,332,180,000 (40%)",
      development_expenditure: "9,498,270,000 (60%)",
      recurrent_percent: "40%",
      development_percent: "60%"
    },
    wards: [
      { id: 'water', name: 'Water & Sanitation', projects: ['Urban Water Reservoirs', 'Underground Sewer Modernization', 'Drilling of County Boreholes'] },
      { id: 'health', name: 'Health Services', projects: ['Level 4 Hospital Restocking', 'County Ambulance Tracking', 'Rural Health Center Solarisation'] },
      { id: 'infra', name: 'Infrastructure & Roads', projects: ['Cabro Paved Commuter Terminal', 'Drainage Deficit Solutions', 'County Bypass Tarmacking'] },
      { id: 'ict', name: 'Education & ICT Support', projects: ['Vocational Training ICT Gear', 'Cloud Integration for Permits', 'Secondary School Bursaries'] },
      { id: 'trade', name: 'Trading & Markets', projects: ['Multi-Storey Open Air Market', 'Solar Streetlight Interventions', 'Trade Fair & Farmers Expo'] }
    ]
  },
  {
    id: "cob",
    name: "County Review (COB)",
    flagEmoji: "📈",
    fileName: "THE-REPORT-OF-THE-OFFICE-OF-CONTROLLER-OF-BUDGET-ON-COUNTY-GOVERNMENTS-BUDGET-IMPLEMENTATION-REVIEW-FOR-THE-FIRST-HALF-OF-FY-2024-2025.pdf",
    fileSize: "29.76 MB",
    metadata: {
      county: "Controller of Budget Review",
      year: "2024/2025 (H1)",
      total_estimate: "534,840,000,000",
      own_source_revenue: "38,590,000,500",
      equitable_share: "391,120,400,000",
      recurrent_expenditure: "374,388,000,000 (70%)",
      development_expenditure: "160,452,000,000 (30%)",
      recurrent_percent: "70%",
      development_percent: "30%"
    },
    wards: [
      { id: 'revenue', name: 'Revenue Audit', projects: ['Automation Integrity Verification', 'Own Source Revenue Leakage Spot-checks', 'Local Collection Expansion Metrics'] },
      { id: 'personnel', name: 'Personnel & Wages', projects: ['Ghost Worker Verification Audit', 'County Travel Overrun Reviews', 'Pending Bills Clearance Inspection'] },
      { id: 'dev_spend', name: 'Development Spend', projects: ['Stalled Project Audits', 'Contractor Liquidated damages reviews', 'Asset Tagging verification'] },
      { id: 'absorption', name: 'Absorption Metrics', projects: ['Budget Release Lag Assessments', 'Lapsed Allocations Analysis', 'Quarterly Revenue Allocations Reviews'] }
    ]
  }
];
