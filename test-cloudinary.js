// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary Onboarding Test Script — React Native / Node.js
// Run with:  node test-cloudinary.js
// ─────────────────────────────────────────────────────────────────────────────

const cloudinary = require("cloudinary").v2;

// ── 1. CONFIGURE ──────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: "dgdn58hpw",   // ← replace this if you change accounts
  api_key:    "272864567725746",  // ← replace this if you change accounts
  api_secret: "v0BBV6CZQE-x1ryUdXLsg9Qxvu4", // ← replace this if you change accounts
  secure: true,
});

// Sample image from Cloudinary's own demo domain
const SAMPLE_IMAGE_URL = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

async function main() {
  console.log("🌩️  Cloudinary Integration Test — AgroConecta\n");

  // ── 2. UPLOAD ────────────────────────────────────────────────────────────────
  console.log("📤 Uploading sample image...");
  const uploadResult = await cloudinary.uploader.upload(SAMPLE_IMAGE_URL, {
    public_id: "agroconecta_test_sample",
    overwrite: true,
  });

  console.log("✅ Upload complete!");
  console.log("   Secure URL :", uploadResult.secure_url);
  console.log("   Public ID  :", uploadResult.public_id);
  console.log();

  // ── 3. GET IMAGE DETAILS ─────────────────────────────────────────────────────
  console.log("🔍 Fetching image metadata...");
  const details = await cloudinary.api.resource(uploadResult.public_id);

  console.log("   Width      :", details.width, "px");
  console.log("   Height     :", details.height, "px");
  console.log("   Format     :", details.format);
  console.log("   File size  :", details.bytes, "bytes");
  console.log();

  // ── 4. TRANSFORM IMAGE ───────────────────────────────────────────────────────
  // f_auto → Cloudinary picks the best format for the browser (WebP, AVIF, etc.)
  // q_auto → Cloudinary adjusts quality automatically to balance size and clarity
  const transformedUrl = cloudinary.url(uploadResult.public_id, {
    transformation: [
      { fetch_format: "auto" }, // f_auto: automatic format selection
      { quality: "auto" },      // q_auto: automatic quality optimisation
    ],
  });

  console.log("🎉 Done! Click link below to see the optimised version of the image.");
  console.log("   Check the size and the format.\n");
  console.log("   Transformed URL:", transformedUrl);
}

main().catch((err) => {
  console.error("❌ Error:", err.message || err);
  process.exit(1);
});
