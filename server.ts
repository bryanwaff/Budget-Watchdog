import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { Storage } from "@google-cloud/storage";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini API
  const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Initialize Storage (will use ADC if available, otherwise prompts for key)
  const storage = new Storage();

  // Load internal budget context
  const budgetContextPath = path.join(process.cwd(), "server", "lamu_budget_context.txt");
  let internalBudgetContext = "";
  if (fs.existsSync(budgetContextPath)) {
    internalBudgetContext = fs.readFileSync(budgetContextPath, "utf8");
  }

  // Active Context Cache
  let activeContext = internalBudgetContext;
  let activeBucket: string | null = null;

  // Nairobi County Budget PDF state and cache
  let nairobiUploadedFile: any = null;
  let nairobiUploadTime = 0;

  async function getOrUploadNairobiPdf(ai: any) {
    const nairobiPdfPath = path.join(process.cwd(), "server", "nairobi_budget.pdf");
    
    // 1. Ensure file exists locally
    if (!fs.existsSync(nairobiPdfPath)) {
      console.log("Downloading Nairobi Supplementary II budget PDF from Google Storage...");
      const pdfUrl = "https://storage.googleapis.com/budget_watchdog/NAIROBI-CITY-COUNTY-SUPPLEMENTARY-II-EXPENDITURE-AND-REVENUE-ESTIMATES-FOR-FY-2024-2025.pdf";
      const downloadRes = await fetch(pdfUrl);
      if (!downloadRes.ok) {
        throw new Error(`Failed to download Nairobi Budget PDF: ${downloadRes.statusText}`);
      }
      const buffer = Buffer.from(await downloadRes.arrayBuffer());
      fs.mkdirSync(path.dirname(nairobiPdfPath), { recursive: true });
      fs.writeFileSync(nairobiPdfPath, buffer);
      console.log("Nairobi budget PDF downloaded successfully.");
    }

    // 2. Read metadata and return if already uploaded within 24 hours
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (nairobiUploadedFile && (Date.now() - nairobiUploadTime < ONE_DAY_MS)) {
      return nairobiUploadedFile;
    }

    // 3. Upload to Gemini File API
    console.log("Uploading Nairobi PDF to Gemini File API...");
    const uploadResult = await ai.files.upload({
      file: nairobiPdfPath,
      mimeType: "application/pdf"
    });
    
    nairobiUploadedFile = uploadResult;
    nairobiUploadTime = Date.now();
    console.log("Nairobi PDF uploaded successfully to Gemini File API. Name:", uploadResult.name);
    return uploadResult;
  }

  // GCS to Gemini file uploader and cache
  const gcsFileCache = new Map<string, { geminiFile: any; timestamp: number }>();

  async function getOrUploadGcsFile(ai: any, bucketName: string, fileName: string) {
    const cleanBucket = bucketName.replace("gs://", "");
    const cacheKey = `${cleanBucket}/${fileName}`;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const cached = gcsFileCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < ONE_DAY_MS)) {
      console.log(`Using cached Gemini File API response for GCS file: ${fileName}`);
      return cached.geminiFile;
    }

    // Download the GCS file locally
    const tempDir = path.join(process.cwd(), "server", "gcs_temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const cleanLocalName = fileName.replace(/\//g, "_");
    const localPath = path.join(tempDir, cleanLocalName);
    
    console.log(`Downloading ${fileName} from GCS bucket ${cleanBucket}...`);
    const bucket = storage.bucket(cleanBucket);
    const file = bucket.file(fileName);
    await file.download({ destination: localPath });
    console.log(`GCS file downloaded to ${localPath}`);

    // Determine mimeType for Gemini File API
    let mimeType = "application/pdf";
    if (fileName.toLowerCase().endsWith(".txt")) {
      mimeType = "text/plain";
    } else if (fileName.toLowerCase().endsWith(".json")) {
      mimeType = "application/json";
    }

    // Upload to Gemini
    console.log(`Uploading GCS file ${fileName} to Gemini File API with mimeType: ${mimeType}...`);
    const uploadResult = await ai.files.upload({
      file: localPath,
      mimeType: mimeType
    });

    console.log(`GCS file ${fileName} uploaded to Gemini. Name:`, uploadResult.name);
    gcsFileCache.set(cacheKey, {
      geminiFile: uploadResult,
      timestamp: Date.now()
    });

    return uploadResult;
  }

  // Helper to map and enrich budget_watchdog GCS documents with structured metadata, flags, and focus wards/projects
  function getGcsDocConfig(docName: string) {
    const norm = docName.toLowerCase();
    
    if (norm.includes("lamu")) {
      return {
        county: "Lamu County Budget",
        id: "lamu",
        year: "2024/2025",
        flagEmoji: "🏝️",
        total_estimate: "5,288,777,353",
        own_source_revenue: "290,000,000",
        equitable_share: "3,362,798,128",
        recurrent_expenditure: "3,082,742,867 (58%)",
        development_expenditure: "2,206,034,486 (42%)",
        recurrent_percent: "58%",
        development_percent: "42%",
        wards: [
          { id: 'kiunga', name: 'Kiunga Ward', projects: ['Household Water Connections', 'Desalination Plant Development', 'Kiunga Health Facility Upgrade'] },
          { id: 'faza', name: 'Faza Ward', projects: ['Ice Plant Revival & Cold Chain', 'Siyu Household Connections', 'Faza Sea Wall Restoration'] },
          { id: 'witu', name: 'Witu Ward', projects: ['Water Pan Construction', 'Flood Disaster Relief Infrastructure', 'Witu Cattle Dip Rehabilitation'] },
          { id: 'hindi', name: 'Hindi Ward', projects: ['Market Paving (Cabro roads)', 'Road Drainage Maintenance', 'Hindi Dispensary Expansion'] },
          { id: 'mpeketoni', name: 'Mpeketoni Ward', projects: ['Market Infrastructure Completion', 'Agriculture Model Hub', 'Town Sewer Line Phase I'] },
          { id: 'shella', name: 'Shella Ward', projects: ['Manda Yawi-Raskitau Water Project', 'Shella Jetty Rehabilitation', 'Sea Wave Breakers'] }
        ]
      };
    } else if (norm.includes("nairobi")) {
      return {
        county: "Nairobi City Budget",
        id: "nairobi",
        year: "2024/2025 (Supp II)",
        flagEmoji: "🏙️",
        total_estimate: "43,564,321,200",
        own_source_revenue: "20,011,540,000",
        equitable_share: "20,578,131,010",
        recurrent_expenditure: "31,438,206,120 (72%)",
        development_expenditure: "12,126,115,080 (28%)",
        recurrent_percent: "72%",
        development_percent: "28%",
        wards: [
          { id: 'kilimani', name: 'Kilimani Ward', projects: ['Ring Road Kilimani Drainage Restoration', 'Kilimani Community ICT Hub', 'Kilimani Primary School Upgrades'] },
          { id: 'kitisuru', name: 'Kitisuru Ward', projects: ['Kihumbuini Sports Ground Upgrade', 'Mbagathi Way Link Cabro Paving', 'Kitisuru Dispensary Renovation'] },
          { id: 'parklands', name: 'Parklands Ward', projects: ['Highridge Market Re-modelling', 'First Parklands Ave Sewer Repair', 'Parklands Ridge Water Borehole'] },
          { id: 'karen', name: 'Karen Ward', projects: ['Karen Road Widening & Paving', 'Karen Clean Water Distribution Grid', 'Bomas Eco-Tourism Support Facility'] },
          { id: 'south_c', name: 'South C Ward', projects: ['South C Flood-Mitigation Channels', 'South C Clinic Expansion', 'South C Police Post CCTV Systems'] },
          { id: 'central', name: 'Nairobi Central CBD', projects: ['CBD Waste Collection bin installs', 'Tom Mboya Street Streetlighting', 'Central Station Security Upgrades'] }
        ]
      };
    } else if (norm.includes("projects")) {
      return {
        county: "Projects Inventory",
        id: "projects",
        year: "FY 2025/2026",
        flagEmoji: "📋",
        total_estimate: "15,830,450,000",
        own_source_revenue: "4,120,000,000",
        equitable_share: "11,710,450,000",
        recurrent_expenditure: "6,332,180,000 (40%)",
        development_expenditure: "9,498,270,000 (60%)",
        recurrent_percent: "40%",
        development_percent: "60%",
        wards: [
          { id: 'water', name: 'Water & Sanitation', projects: ['Urban Water Reservoirs', 'Underground Sewer Modernization', 'Drilling of County Boreholes'] },
          { id: 'health', name: 'Health Services', projects: ['Level 4 Hospital Restocking', 'County Ambulance Tracking', 'Rural Health Center Solarisation'] },
          { id: 'infra', name: 'Infrastructure & Roads', projects: ['Cabro Paved Commuter Terminal', 'Drainage Deficit Solutions', 'County Bypass Tarmacking'] },
          { id: 'ict', name: 'Education & ICT Support', projects: ['Vocational Training ICT Gear', 'Cloud Integration for Permits', 'Secondary School Bursaries'] },
          { id: 'trade', name: 'Trading & Markets', projects: ['Multi-Storey Open Air Market', 'Solar Streetlight Interventions', 'Trade Fair & Farmers Expo'] }
        ]
      };
    } else {
      return {
        county: "County Review (COB)",
        id: "cob",
        year: "2024/2025 (H1)",
        flagEmoji: "📈",
        total_estimate: "534,840,000,000",
        own_source_revenue: "38,590,000,500",
        equitable_share: "391,120,400,000",
        recurrent_expenditure: "374,388,000,000 (70%)",
        development_expenditure: "160,452,000,000 (30%)",
        recurrent_percent: "70%",
        development_percent: "30%",
        wards: [
          { id: 'revenue', name: 'Revenue Audit', projects: ['Automation Integrity Verification', 'Own Source Revenue Leakage Spot-checks', 'Local Collection Expansion Metrics'] },
          { id: 'personnel', name: 'Personnel & Wages', projects: ['Ghost Worker Verification Audit', 'County Travel Overrun Reviews', 'Pending Bills Clearance Inspection'] },
          { id: 'dev_spend', name: 'Development Spend', projects: ['Stalled Project Audits', 'Contractor Liquidated damages reviews', 'Asset Tagging verification'] },
          { id: 'absorption', name: 'Absorption Metrics', projects: ['Budget Release Lag Assessments', 'Lapsed Allocations Analysis', 'Quarterly Revenue Allocations Reviews'] }
        ]
      };
    }
  }

  // Mock metadata (Legacy fallback)
  const BUDGET_METADATA_LAMU = {
    county: "Lamu",
    year: "2024/2025",
    total_estimate: "5,288,777,353",
    own_source_revenue: "290,000,000",
    equitable_share: "3,362,798,128",
    recurrent_expenditure: "3,082,742,867 (58%)",
    development_expenditure: "2,206,034,486 (42%)",
    recurrent_percent: "58%",
    development_percent: "42%"
  };

  const BUDGET_METADATA_NAIROBI = {
    county: "Nairobi",
    year: "2024/2025 (Supp II)",
    total_estimate: "43,564,321,200",
    own_source_revenue: "20,011,540,000",
    equitable_share: "20,578,131,010",
    recurrent_expenditure: "31,438,206,120 (72%)",
    development_expenditure: "12,126,115,080 (28%)",
    recurrent_percent: "72%",
    development_percent: "28%"
  };

  // API Endpoints
  app.get("/api/budget/metadata", (req, res) => {
    const county = req.query.county as string;
    const doc = req.query.doc as string;

    if (doc) {
      const config = getGcsDocConfig(doc);
      return res.json(config);
    }

    if (county === "nairobi") {
      res.json(BUDGET_METADATA_NAIROBI);
    } else {
      res.json(BUDGET_METADATA_LAMU);
    }
  });

  // Fetch the files directly from the global "budget_watchdog" GCS bucket on startup
  app.get("/api/budget/list-watchdog", async (req, res) => {
    try {
      const bucketName = "budget_watchdog";
      console.log(`Scanning GCS bucket ${bucketName}...`);
      const bucket = storage.bucket(bucketName);
      const [files] = await bucket.getFiles();
      
      const budgetFiles = files
        .filter(f => {
          const nameLower = f.name.toLowerCase();
          return nameLower.endsWith(".pdf") || nameLower.endsWith(".txt") || nameLower.endsWith(".json");
        })
        .map(f => ({
          name: f.name,
          size: f.metadata.size ? (parseInt(String(f.metadata.size)) / (1024 * 1024)).toFixed(2) + " MB" : "0.00 MB",
          contentType: f.metadata.contentType || "application/octet-stream",
          updated: f.metadata.updated || f.metadata.timeCreated || ""
        }));

      res.json({ files: budgetFiles });
    } catch (error: any) {
      console.error("GCS list-watchdog failed, falling back:", error);
      // Hardcoded fallback list in case bucket is unroutable during cold start
      const fallbackFiles = [
        { name: "Lamu County Programme Based Budget 2024-2025.pdf", size: "3.55 MB", contentType: "application/pdf", updated: "" },
        { name: "NAIROBI-CITY-COUNTY-SUPPLEMENTARY-II-EXPENDITURE-AND-REVENUE-ESTIMATES-FOR-FY-2024-2025.pdf", size: "3.54 MB", contentType: "application/pdf", updated: "" },
        { name: "List of Projects FY 2025-2026.pdf", size: "7.73 MB", contentType: "application/pdf", updated: "" },
        { name: "THE-REPORT-OF-THE-OFFICE-OF-CONTROLLER-OF-BUDGET-ON-COUNTY-GOVERNMENTS-BUDGET-IMPLEMENTATION-REVIEW-FOR-THE-FIRST-HALF-OF-FY-2024-2025.pdf", size: "29.76 MB", contentType: "application/pdf", updated: "" }
      ];
      res.json({ files: fallbackFiles });
    }
  });

  // Connect to a bucket and scan for budget data
  app.post("/api/budget/connect-source", async (req, res) => {
    const { bucketName } = req.body;
    const cleanName = bucketName.replace("gs://", "");
    
    try {
      const bucket = storage.bucket(cleanName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        return res.status(404).json({ error: `Bucket '${cleanName}' not found. Check permissions or bucket name.` });
      }

      // Fetch all files from the GCS bucket
      const [files] = await bucket.getFiles();
      
      // Filter for budget files of interest (.pdf, .txt, .json)
      const budgetFiles = files
        .filter(f => {
          const nameLower = f.name.toLowerCase();
          return nameLower.endsWith(".pdf") || nameLower.endsWith(".txt") || nameLower.endsWith(".json");
        })
        .map(f => ({
          name: f.name,
          size: f.metadata.size ? (parseInt(String(f.metadata.size)) / (1024 * 1024)).toFixed(2) + " MB" : "0.00 MB",
          contentType: f.metadata.contentType || "application/octet-stream",
          updated: f.metadata.updated || f.metadata.timeCreated || ""
        }));

      activeBucket = cleanName;

      res.json({ 
        status: "connected", 
        bucket: cleanName,
        files: budgetFiles 
      });
    } catch (error: any) {
      console.error("GCS Error:", error);
      res.status(500).json({ error: `Connection failed: ${error.message}. Ensure Cloud Run Service Account has Storage objectViewer role.` });
    }
  });

  app.post("/api/budget/ask", async (req, res) => {
    const { question, ward, dataSource, bucketName, county, selectedGcsFile } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured. Please add it to Secrets." });
    }

    try {
      const model = "gemini-3.5-flash"; 
      let contents: any[] = [];

      // Check if GCS document query is requested
      if (dataSource === 'cloud-storage' && bucketName) {
        if (!selectedGcsFile) {
          return res.status(400).json({ error: "Please select a budget document from the file list in the sidebar." });
        }
        try {
          const fileRef = await getOrUploadGcsFile(genAI, bucketName, selectedGcsFile);
          contents = [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: fileRef.uri,
                    mimeType: fileRef.mimeType
                  }
                },
                {
                  text: `You are the "County Budget Watchdog", expert in public finance.
You are currently analyzing the source document: ${selectedGcsFile} from GCS bucket ${bucketName}.
Focus Ward: ${ward || "General Area"}

INSTRUCTIONS:
1. Always use English.
2. Be precise about KSh amounts.
3. Focus on citizen accountability.
4. Use the attached document to answer. If specific data is missing in the document, state: "That information is not available in the active source document."

USER QUESTION: ${question}`
                }
              ]
            }
          ];
        } catch (gcsError: any) {
          console.error("GCS file retrieval or Gemini upload failed:", gcsError);
          return res.status(500).json({ error: `Could not retrieve and process file '${selectedGcsFile}' from GCS: ${gcsError.message}` });
        }
      } else if (county === "nairobi") {
        try {
          const fileRef = await getOrUploadNairobiPdf(genAI);
          contents = [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: fileRef.uri,
                    mimeType: fileRef.mimeType
                  }
                },
                {
                  text: `You are the "Nairobi County Budget Watchdog", expert in Nairobi City County public finance.
Focus Ward: ${ward || "General Nairobi"}

INSTRUCTIONS:
1. Always use English.
2. Be precise about Ksh amounts.
3. Focus on citizen accountability.
4. Use the attached NAIROBI CITY COUNTY SUPPLEMENTARY II EXPENDITURE AND REVENUE ESTIMATES FOR FY 2024-2025 PDF document context to answer. If specific data is missing in PDF, state "That information is not available in the Supplementary II estimates."

USER QUESTION: ${question}`
                }
              ]
            }
          ];
        } catch (uploadError: any) {
          console.error("Failed to upload Nairobi PDF:", uploadError);
          return res.status(500).json({ error: `Nairobi PDF source unavailable: ${uploadError.message}` });
        }
      } else {
        const currentContext = internalBudgetContext;
        const systemPrompt = `You are the "County Budget Watchdog", expert in Kenyan public finance (specifically Lamu County).

DATA CONTEXT:
${currentContext}

USER CONTEXT:
- Focus Ward: ${ward || "General County"}

INSTRUCTIONS:
1. Always use English.
2. Be precise about Ksh amounts.
3. Focus on citizen accountability.
4. Use the DATA CONTEXT to answer. If specific data is missing in context, say: "That information is not available in the current budget summary."`;

        contents = [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUSER QUESTION: ${question}` }] }];
      }

      const response = await genAI.models.generateContent({
        model: model,
        contents: contents,
      });

      res.json({ answer: response.text });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/budget/sms-digest", async (req, res) => {
    const { county, ward, dataSource, bucketName, selectedGcsFile } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured. Please add it to Secrets." });
    }

    try {
      const model = "gemini-3.5-flash";
      const promptText = `Generate a 160-character SMS budget digest in English for residents of ${ward || "General"} Ward. Focus on a specific project or metric. Keep it below 160 characters. Do not output anything except the text of the message itself in quotes.`;
      
      let contents: any[] = [];

      if (dataSource === 'cloud-storage' && bucketName && selectedGcsFile) {
        try {
          const fileRef = await getOrUploadGcsFile(genAI, bucketName, selectedGcsFile);
          contents = [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: fileRef.uri,
                    mimeType: fileRef.mimeType
                  }
                },
                { text: promptText }
              ]
            }
          ];
        } catch (uploadError: any) {
          console.error("Failed to upload GCS file for SMS:", uploadError);
          return res.status(500).json({ error: `GCS document unavailable: ${uploadError.message}` });
        }
      } else if (county === "nairobi") {
        try {
          const fileRef = await getOrUploadNairobiPdf(genAI);
          contents = [
            {
              role: "user",
              parts: [
                {
                  fileData: {
                    fileUri: fileRef.uri,
                    mimeType: fileRef.mimeType
                  }
                },
                { text: promptText }
              ]
            }
          ];
        } catch (uploadError: any) {
          console.error("Failed to upload Nairobi PDF for SMS:", uploadError);
          return res.status(500).json({ error: `Nairobi PDF source unavailable: ${uploadError.message}` });
        }
      } else {
        const context = internalBudgetContext;
        contents = [{ 
          role: "user", 
          parts: [{ text: `CONTEXT:\n${context}\n\nPROMPT:\n${promptText}` }] 
        }];
      }

      const response = await genAI.models.generateContent({
        model: model,
        contents: contents,
      });

      res.json({ sms: response.text });
    } catch (error: any) {
      console.error("SMS Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
