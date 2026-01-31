
import { GoogleGenAI, Type } from "@google/genai";
import { Product, ShadowSpecs, ProductCategory } from "../types";
import { getEnv } from "../lib/dataBridge";

const getAI = () => {
  const apiKey = getEnv('API_KEY');
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const classifyProductDomain = async (manufacturer: string, model: string): Promise<{
  isSolarDomain: boolean;
  category: ProductCategory | null;
  confidence: number;
  reason?: string;
}> => {
  const ai = getAI();
  if (!ai) return { isSolarDomain: false, category: null, confidence: 0, reason: "API Key Missing" };

  const prompt = `Classify if the following product belongs to the Solar & Backup Power domain (Portable Power Stations, Solar Panels, Inverters, LiFePO4 Batteries, Charge Controllers).
  Product: ${manufacturer} ${model}

  Rules:
  - Allowed: Power stations (EcoFlow, Bluetti), Panels, Inverters, Home batteries (Powerwall).
  - Blocked: Consumer electronics (AirPods, Phones), Vehicles (Cars, Bikes), Appliances (Toasters, Fridges - unless they are specialized 12V DC camping fridges).
  - Categorize strictly into one of: portable_power_station, solar_generator_kit, solar_panel, inverter, battery, charge_controller.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSolarDomain: { type: Type.BOOLEAN },
            category: { type: Type.STRING, nullable: true },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING },
          },
          required: ["isSolarDomain", "category", "confidence"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (e) {
    console.error("Classification failure", e);
    return { isSolarDomain: false, category: null, confidence: 0, reason: "Classification engine error" };
  }
};

export const runForensicScan = async (product: Product): Promise<{
  specs: Partial<ShadowSpecs>;
  sources: { title: string; uri: string; type: 'official' | 'community' | 'technical' }[];
}> => {
  const ai = getAI();
  if (!ai) throw new Error("API Key Missing");

  const manufacturerQuery = product.brand.toLowerCase() === 'vtoman' ? 'VTOMAN (Stylized: VTOman)' : product.brand;

  const prompt = `ACT AS A LEAD FORENSIC ENGINEER. 
  Perform a deep-dive technical audit on the ${manufacturerQuery} ${product.model_name}. 
  
  MANDATORY EXTRACTION PROTOCOL:
  1. REDDIT FORENSICS: Query r/Solar, r/Preppers, and r/PortablePower for owner troubleshoot logs.
  2. TECHNICAL DISCHARGE TESTS: Find measured Wh (Watt-hours) and surge peaks.
  3. PDF MANUAL SCRAPE: Extract peak surge duration and thermal cut-off points.
  4. FCC ID LOOKUP: Check for hardware revisions.

  OUTPUT REQUIREMENTS:
  - Calculate a Truth Score (0-100) reflecting claim discrepancy. MUST BE AN INTEGER.
  - Return in specific JSON structure.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 12000 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          truth_score: { type: Type.INTEGER },
          advertised_claims: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
              },
              required: ["label", "value"],
            },
          },
          reality_fields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
              },
              required: ["label", "value"],
            },
          },
          discrepancies: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                issue: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["issue", "description"],
            },
          },
        },
        required: ["truth_score", "advertised_claims", "reality_fields", "discrepancies"],
      },
    },
  });

  const text = response.text || "{}";
  let parsed = { truth_score: 80, advertised_claims: [], reality_fields: [], discrepancies: [] };
  
  try {
    parsed = JSON.parse(text);
    parsed.truth_score = Math.round(parsed.truth_score);
  } catch (e) {
    console.error("Forensic synthesis engine failed to parse output", e);
  }

  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map((chunk: any) => ({
      title: chunk.web?.title || "Evidence Log",
      uri: chunk.web?.uri || "",
      type: (chunk.web?.uri?.includes('reddit') ? 'community' : 'technical') as any
    }))
    .filter((s: any) => s.uri) || [];

  return {
    specs: {
      truth_score: parsed.truth_score,
      claimed_specs: parsed.advertised_claims,
      actual_specs: parsed.reality_fields,
      red_flags: parsed.discrepancies,
      created_at: new Date().toLocaleDateString(),
    },
    sources
  };
};
