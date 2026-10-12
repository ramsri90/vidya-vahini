import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getCleanConfig() {
  const endpoint = (process.env.R2_ENDPOINT ?? "").trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID ?? "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY ?? "").trim();
  const bucketName = (process.env.R2_BUCKET_NAME ?? "").trim();

  // Extract region from endpoint (e.g., s3.us-east-005.backblazeb2.com -> us-east-005) or default to auto
  let region = "auto";
  const match = endpoint.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  if (match && match[1]) {
    region = match[1];
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucketName,
    region,
  };
}

let cachedClient: S3Client | null = null;

export function getS3Client(): S3Client {
  if (cachedClient) return cachedClient;

  const config = getCleanConfig();
  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Backblaze B2 supports virtual-hosted style with correct region
    forcePathStyle: false,
  });

  return cachedClient;
}

export function getBucketName(): string {
  return getCleanConfig().bucketName;
}

/**
 * Creates a presigned PUT URL for uploading a file directly to storage.
 * URL is valid for the specified number of seconds (default: 300).
 */
export async function createUploadUrl(
  storageKey: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: contentType,
  });

  return await getSignedUrl(client, command, { expiresIn });
}

/**
 * Checks if an object exists in storage and returns its metadata.
 * Returns null if the object does not exist.
 */
export async function headObject(
  storageKey: string
): Promise<{ contentLength: number; contentType?: string } | null> {
  const client = getS3Client();
  const bucket = getBucketName();

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });
    const res = await client.send(command);
    return {
      contentLength: Number(res.ContentLength ?? 0),
      contentType: res.ContentType,
    };
  } catch (err: unknown) {
    const errorName = (err as { name?: string; $metadata?: { httpStatusCode?: number } })?.name;
    const statusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (errorName === "NotFound" || statusCode === 404) {
      return null;
    }
    // Re-throw genuine connection or permission errors
    throw err;
  }
}

/**
 * Fetches the initial bytes of an object to verify magic byte signatures.
 */
export async function getObjectHeaderBytes(
  storageKey: string,
  byteCount = 16
): Promise<Buffer | null> {
  const client = getS3Client();
  const bucket = getBucketName();

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Range: `bytes=0-${byteCount - 1}`,
    });
    const res = await client.send(command);
    if (!res.Body) return null;
    const byteArray = await res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  } catch {
    return null;
  }
}

/**
 * Deletes an object from storage.
 */
export async function deleteObject(storageKey: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  await client.send(command);
  return true;
}

/**
 * Creates a presigned GET URL for downloading a file from storage.
 */
export async function createDownloadUrl(
  storageKey: string,
  expiresIn = 600
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  return await getSignedUrl(client, command, { expiresIn });
}
