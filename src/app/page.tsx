"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);

  // Cleanup object URL on unmount or when previewUrl changes
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setUploadedImageUrl(null);
      setCopySuccess(false);

      // Revoke existing preview URL if present
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      // Create preview URL using object URL
      try {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      } catch (err) {
        setError("Failed to create image preview");
        setPreviewUrl(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select an image first");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      const imageUrl = data.imageUrl || data.url || data.image_url || null;
      
      if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") {
        throw new Error("Upload succeeded but no imageUrl was returned");
      }
      
      setUploadedImageUrl(imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-2xl p-8 bg-white dark:bg-black rounded-lg shadow-lg">
        <h1 className="text-3xl font-semibold mb-8 text-center text-black dark:text-zinc-50">
          Image Upload
        </h1>

        <div className="space-y-6">
          {/* File Input */}
          <div>
            <label
              htmlFor="image-upload"
              className="block text-sm font-medium mb-2 text-black dark:text-zinc-50"
            >
              Select Image
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-zinc-600 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white dark:file:bg-white dark:file:text-black hover:file:bg-zinc-800 dark:hover:file:bg-zinc-200 cursor-pointer"
            />
          </div>

          {/* Preview */}
          {previewUrl && (
            <div>
              <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                Preview
              </label>
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-4 flex justify-center">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-96 object-contain rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full py-3 px-4 bg-black text-white dark:bg-white dark:text-black rounded-full font-semibold transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? "Uploading..." : "Upload Image"}
          </button>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Uploaded Image URL */}
          {uploadedImageUrl && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                Uploaded Image URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={uploadedImageUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-black dark:text-zinc-50"
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(uploadedImageUrl);
                      
                      // Clear any existing timeout
                      if (copyTimeoutRef.current !== null) {
                        clearTimeout(copyTimeoutRef.current);
                      }
                      
                      setCopySuccess(true);
                      setError(null);
                      copyTimeoutRef.current = window.setTimeout(() => {
                        setCopySuccess(false);
                        copyTimeoutRef.current = null;
                      }, 2000);
                    } catch (err) {
                      setError("Failed to copy URL to clipboard");
                      setCopySuccess(false);
                    }
                  }}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white rounded-lg text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  {copySuccess ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="mt-4 flex justify-center">
                <img
                  src={uploadedImageUrl}
                  alt="Uploaded"
                  className="max-w-full max-h-96 object-contain rounded-lg border border-zinc-300 dark:border-zinc-700"
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}