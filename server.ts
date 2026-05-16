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

  // Mock metadata
  const BUDGET_METADATA = {
    county: "Lamu",
    year: "2024/2025",
    total_estimate: "5,288,777,353",
    own_source_revenue: "290,000,000",
    equitable_share: "3,362,798,128",
    recurrent_expenditure: "3,082,742,867 (58%)",
    development_expenditure: "2,206,034,486 (42%)",
  };

  // API Endpoints
  app.get("/api/budget/metadata", (req, res) => {
    res.json(BUDGET_METADATA);
  });

  // Connect to a bucket and scan for budget data
  app.post("/api/budget/connect-source", async (req, res) => {
    const { bucketName } = req.body;
    const cleanName = bucketName.replace("gs://", "");
    
    try {
      const bucket = storage.bucket(cleanName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        return res.status(404).json({ error: "Bucket not found. Check permissions or bucket name." });
      }

      // Try to find a readme or project summary to use as context
      const [files] = await bucket.getFiles({ prefix: "budget" });
      if (files.length > 0) {
        const [content] = await files[0].download();
        activeContext = content.toString();
        activeBucket = cleanName;
        res.json({ status: "connected", fileCount: files.length, source: files[0].name });
      } else {
        // Fallback to empty if no docs found
        activeContext = "Cloud Storage Source: No relevant budget documents found in prefix 'budget*'.";
        activeBucket = cleanName;
        res.json({ status: "connected", fileCount: 0 });
      }
    } catch (error: any) {
      console.error("GCS Error:", error);
      res.status(500).json({ error: `Connection failed: ${error.message}. Ensure Cloud Run Service Account has Storage objectViewer role.` });
    }
  });

  app.post("/api/budget/ask", async (req, res) => {
    const { question, ward, dataSource, bucketName } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured. Please add it to Secrets." });
    }

    try {
      const model = "gemini-3-flash-preview"; 
      
      // Use bucket context if requested, otherwise fallback to internal
      const currentContext = (dataSource === 'cloud-storage' && activeBucket === bucketName?.replace("gs://", "")) 
        ? activeContext 
        : internalBudgetContext;

      const systemPrompt = `
        You are the "County Budget Watchdog", expert in Kenyan public finance.
        MODE: ${dataSource === 'cloud-storage' ? `Cloud Storage (${bucketName})` : 'Internal Master Records'}
        
        DATA CONTEXT:
        ${currentContext}
        
        USER CONTEXT:
        - Focus Ward: ${ward || "General County"}
        
        INSTRUCTIONS:
        1. Always use English.
        2. Be precise about Ksh amounts.
        3. Focus on citizen accountability.
        4. Use the DATA CONTEXT to answer. If specific data is missing in context, say: "That information is not available in the current budget summary."
      `;

      const response = await genAI.models.generateContent({
        model: model,
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUSER QUESTION: ${question}` }] }],
      });

      res.json({ answer: response.text });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/budget/sms-digest", async (req, res) => {
    const { ward } = req.body;
    
    try {
      const model = "gemini-3-flash-preview";
      const prompt = `Generate a 160-character SMS budget digest in English for residents of ${ward} Ward. Focus on a specific project from the master context. Keep it below 160 chars. Context: ${activeContext || internalBudgetContext}`;
      
      const response = await genAI.models.generateContent({
        model: model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      res.json({ sms: response.text });
    } catch (error: any) {
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
