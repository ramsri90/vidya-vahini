import "dotenv/config";
import { getS3Client, getBucketName, createUploadUrl, headObject, deleteObject } from "../src/lib/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";

async function checkStorage() {
  console.log("=== STORAGE CONNECTIVITY CHECK ===");

  const hasEndpoint = Boolean(process.env.R2_ENDPOINT);
  const bucket = getBucketName();
  const hasKeyId = Boolean(process.env.R2_ACCESS_KEY_ID);
  const hasSecret = Boolean(process.env.R2_SECRET_ACCESS_KEY);

  console.log("Endpoint Configured:", hasEndpoint);
  console.log("Bucket Configured:", Boolean(bucket));
  console.log("Access Key ID:", hasKeyId ? "***" : "(missing)");
  console.log("Secret Access Key:", hasSecret ? "***" : "(missing)");

  if (!hasEndpoint || !bucket || !hasKeyId || !hasSecret) {
    throw new Error("Missing storage environment variables.");
  }

  const client = getS3Client();
  const testKey = `test/storage-check-${Date.now()}.txt`;
  const testContent = "Storage check connectivity test content";

  console.log("\n1. Testing PutObject...");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: "text/plain",
    })
  );
  console.log("--> PutObject succeeded.");

  console.log("\n2. Testing HeadObject...");
  const head = await headObject(testKey);
  if (!head || head.contentLength !== Buffer.byteLength(testContent)) {
    throw new Error(`HeadObject verification failed: ${JSON.stringify(head)}`);
  }
  console.log("--> HeadObject verified, contentLength:", head.contentLength);

  console.log("\n3. Testing Presigned Upload URL generation...");
  const presignedUrl = await createUploadUrl(testKey, "text/plain", 60);
  if (!presignedUrl || !presignedUrl.startsWith("https://")) {
    throw new Error("Presigned URL generation failed.");
  }
  console.log("--> Presigned URL generated successfully (verified valid, unprinted).");

  console.log("\n4. Testing DeleteObject (Cleanup)...");
  await deleteObject(testKey);
  console.log("--> DeleteObject succeeded, test artifact removed.");

  console.log("\n=== STORAGE CONNECTIVITY CHECK PASSED ===");
}

checkStorage().catch((err) => {
  console.error("Storage check failed:", err.message || err);
  process.exit(1);
});
