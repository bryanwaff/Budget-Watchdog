# County Budget Watchdog 🇰🇪🔍

An AI-powered transparency platform that turns complex, 400-page Kenyan county budget documents and Supplementary Estimates into direct, plain-language answers for ward residents. It enables civic tech advocates, community leaders, and local residents to track county distributions, recurrent vs. development expenditures, and ward-level investments.

---

## 🌟 Key Features

### 1. **County Estimate Comparisons**
*   **Budget Metadata Dashboards**: High-level comparison across Kenyan counties (e.g., Lamu vs. Nairobi City County).
*   **Consolidated Metrics**: Clear indicators of overall estimates, recurrent expenditures, development investments, equitable shares, and own-source revenue (OSR).

### 2. **Multi-Source Budget RAG (Retrieval-Augmented Generation)**
*   **Local Budget Datasets**: Answers questions using local contextual knowledge documents.
*   **Nairobi Supplementary II Estimates (FY 24/25)**: Direct visual evaluation of the ~500-page Nairobi County supplementary expenditure estimates.
*   **GCS Storage Bucket Sync**: Directly connect to any target Google Cloud Storage (GCS) bucket, live scan for budget materials (`.pdf`, `.txt`, `.json`), and ingest documents for analysis files.

### 3. **AI Chat & Ward Controls**
*   **Ward-Specific Inquiries**: Contextual focus filters so responses map back to a specific target ward (e.g., Clay City, Roysambu, Kileleshwa, etc.).
*   **Constituent-First Language**: Highlighting key figures, impacts, and simple breakdowns of complex budget nomenclature.

### 4. **Ward Alerts Simulator (SMS Engine)**
*   **Custom Dispatch Text Generation**: Allows users to draft citizen alert messages summarizing budget shifts.
*   ** constituents Notifications**: Craft short, high-impact SMS templates directly using budget documents.

---

## 🔧 Technical Deep-Dive

### **The `@google/genai` Integration Resolution**

During development, we resolved a critical API exception resulting from invalid model content schemas:
```json
{"error":{"code":400,"message":"* GenerateContentRequest.contents[0].parts[0].data: required oneof field 'data' must have one initialized field","status":"INVALID_ARGUMENT"}}
```

#### **Solution Implemented**
Under the modern `@google/genai` TypeScript SDK, multimodal inputs involving files retrieved from the **Gemini Files API** (`ai.files.upload`) must not be passed as direct raw objects or incorrectly placed parts inside the `contents` property array. Instead, they require a clear, structured payload utilizing the nested `{ fileData: { fileUri, mimeType } }` format wrapped cleanly inside parts:

```typescript
// ✅ Fixed and implemented pattern:
const response = await genAI.models.generateContent({
  model: "gemini-3.5-flash",
  contents: [
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
          text: `Your budget prompts and context go here...`
        }
      ]
    }
  ]
});
```
This enables native server-side RAG operations over 400-page PDFs uploaded securely to Gemini with no client-side keys exposed.

---

## 🚀 Dev Setup & Production Builds

### **Prerequisites**
Store your Gemini API Credentials in a local `.env` configuration file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### **1. Run Development Server**
Launches the full-stack server supporting both Vite's hot-reloaded client routes and Express endpoints natively on Port 3000:
```bash
npm run dev
```

### **2. Production Compilation & Packaging**
Builds static frontend assets via Vite, bundles the backend server into a single standalone file at `dist/server.cjs` via `esbuild` to prevent ES module resolution lookup exceptions at runtime:
```bash
npm run build
```

### **3. Production Execution**
Run the bundled service:
```bash
npm start
```

---

## 🏛️ Platforms Architecture
*   **Frontend**: React (v19) with Tailwind CSS and standard elegant typography pairings (Space Grotesk + JetBrains Mono), lucide-react icons, and smooth interactive state counters.
*   **Backend**: Express + Vite Node server managing Gemini API integrations, the File API cache engine, and Google Cloud Storage downloads.
*   **Model**: Powered exclusively by `gemini-3.5-flash` for lighting-fast document analysis and contextual public finance summarizations.
