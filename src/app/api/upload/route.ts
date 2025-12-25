import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Use Node.js runtime for filesystem access
export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Generate a safe filename
function generateSafeFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  
  // Get file extension
  const ext = originalName.split(".").pop()?.toLowerCase() || "";
  
  // Create base name: lowercase, replace spaces and special chars with hyphens
  const baseName = originalName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  
  return `${baseName}-${timestamp}-${random}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    // Ensure upload directory exists
    await ensureUploadDir();

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PNG, JPG, JPEG, WEBP, and GIF images are allowed." },
        { status: 400 }
      );
    }

    // Read file as buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate safe filename
    const safeFilename = generateSafeFilename(file.name);
    const filePath = join(UPLOAD_DIR, safeFilename);

    // Write file to disk
    await writeFile(filePath, buffer);

    // Return the public URL path
    const imageUrl = `/uploads/${safeFilename}`;
    
    return NextResponse.json({
      imageUrl,
      url: imageUrl, // Alias for compatibility
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
