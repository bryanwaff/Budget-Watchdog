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
}

export const COUNTIES: County[] = [
  {
    id: "lamu",
    name: "Lamu County",
    flagEmoji: "🏝️",
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
      { id: 'kiunga', name: 'Kiunga', projects: ['Household Water Connections', 'Desalination Plant'] },
      { id: 'faza', name: 'Faza', projects: ['Ice Plant Revival', 'Siyu Household Connections'] },
      { id: 'witu', name: 'Witu', projects: ['Water Pan Construction', 'Flood Disaster Relief'] },
      { id: 'hindi', name: 'Hindi', projects: ['Market Paving (Cabro)', 'Road Maintenance'] },
      { id: 'mpeketoni', name: 'Mpeketoni', projects: ['Market Completion', 'Agriculture Field Day'] },
      { id: 'shella', name: 'Shella', projects: ['Manda Yawi-Raskitau Water Project', 'Jetty Rehabilitation'] },
    ]
  },
  {
    id: "nairobi",
    name: "Nairobi City County",
    flagEmoji: "City 🏙️",
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
      { id: 'kilimani', name: 'Kilimani', projects: ['Ring Road Kilimani Drainage', 'Kilimani ICT Hub', 'Kilimani Primary School Upgrades'] },
      { id: 'kitisuru', name: 'Kitisuru', projects: ['Kihumbuini Sports Ground', 'Mbagathi Way Link Cabro', 'Kitisuru Dispensary Renovation'] },
      { id: 'parklands', name: 'Parklands/Highridge', projects: ['Highridge Market Re-modelling', 'First Parklands Ave Sewer Repair', 'Parklands Ridge Water Borehole'] },
      { id: 'karen', name: 'Karen', projects: ['Karen Road Widening & Paving', 'Karen Clean Water Distribution', 'Bomas Eco-Tourism Support'] },
      { id: 'south_c', name: 'South C', projects: ['South C Ward Flood-Mitigation Channels', 'South C Clinic Expansion', 'South C Police Post Security Cameras'] },
      { id: 'central', name: 'Nairobi Central', projects: ['CBD Waste Collection Bin Installation', 'Tom Mboya Street Streetlighting', 'Central Station Security Upgrade'] },
    ]
  }
];
