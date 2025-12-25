import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Use Node.js runtime for image fetching and API calls
export const runtime = "nodejs";

// Type definitions for the expected response
interface FoodItem {
  name: string;
  estimatedGrams: number | null;
}

interface AnalyzeResponse {
  items: FoodItem[];
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { imageUrl } = body;

    // Validate imageUrl
    if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") {
      return NextResponse.json(
        { error: "imageUrl is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate GEMINI_API_KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not set" },
        { status: 500 }
      );
    }

    // Fetch the image from the URL
    let imageBuffer: Buffer;
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to fetch image from URL: ${error instanceof Error ? error.message : "Unknown error"}` },
        { status: 400 }
      );
    }

    // Convert image to base64
    const base64Image = imageBuffer.toString("base64");
    
    // Determine MIME type from image buffer or URL
    let mimeType = "image/jpeg"; // default
    if (imageUrl.toLowerCase().endsWith(".png")) {
      mimeType = "image/png";
    } else if (imageUrl.toLowerCase().endsWith(".webp")) {
      mimeType = "image/webp";
    } else if (imageUrl.toLowerCase().endsWith(".gif")) {
      mimeType = "image/gif";
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prepare the prompt
    const prompt = `Analyze this food image and identify all food items visible. For each item, estimate the weight in grams if possible, otherwise use null.

Return ONLY valid JSON in this exact format (no markdown, no code blocks, no additional text):
{
  "items": [
    { "name": "item name", "estimatedGrams": 100 },
    { "name": "item name", "estimatedGrams": null }
  ]
}

Be specific with food item names. If you cannot estimate the weight, use null for estimatedGrams.`;

    // Call Gemini Vision API
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (handle cases where Gemini wraps JSON in markdown)
    let jsonText = text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith("```")) {
      const lines = jsonText.split("\n");
      // Remove first line (```json or ```)
      lines.shift();
      // Remove last line (```)
      if (lines.length > 0 && lines[lines.length - 1].trim() === "```") {
        lines.pop();
      }
      jsonText = lines.join("\n").trim();
    }

    // Parse and validate JSON
    let parsedResponse: AnalyzeResponse;
    try {
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", jsonText);
      return NextResponse.json(
        { error: `Failed to parse response as valid JSON. Raw response: ${text.substring(0, 500)}` },
        { status: 500 }
      );
    }

    // Validate the structure
    if (!parsedResponse || typeof parsedResponse !== "object") {
      return NextResponse.json(
        { error: "Invalid response structure: expected an object" },
        { status: 500 }
      );
    }

    if (!Array.isArray(parsedResponse.items)) {
      return NextResponse.json(
        { error: "Invalid response structure: expected 'items' to be an array" },
        { status: 500 }
      );
    }

    // Validate each item
    for (const item of parsedResponse.items) {
      if (!item || typeof item !== "object") {
        return NextResponse.json(
          { error: "Invalid response structure: each item must be an object" },
          { status: 500 }
        );
      }
      if (typeof item.name !== "string") {
        return NextResponse.json(
          { error: "Invalid response structure: each item must have a 'name' string property" },
          { status: 500 }
        );
      }
      if (item.estimatedGrams !== null && (typeof item.estimatedGrams !== "number" || item.estimatedGrams < 0)) {
        return NextResponse.json(
          { error: "Invalid response structure: 'estimatedGrams' must be a number >= 0 or null" },
          { status: 500 }
        );
      }
    }

    // Return the validated response
    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

