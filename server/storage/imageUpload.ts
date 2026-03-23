/**
 * S3/DigitalOcean Spaces image upload module for product images.
 * Uses the same Spaces bucket as the garage app (316-garage-uploads).
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";

const BUCKET = process.env.AWS_BUCKET_NAME || "316-garage-uploads";
const SPACES_ENDPOINT = "https://nyc3.digitaloceanspaces.com";
const CDN_ENDPOINT = `https://${BUCKET}.nyc3.digitaloceanspaces.com`;

const s3 = new S3Client({
  region: "nyc3",
  endpoint: SPACES_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: false,
});

/**
 * Upload a product image to DigitalOcean Spaces.
 * Returns the full CDN URL of the uploaded image.
 */
export async function uploadProductImage(
  buffer: Buffer,
  productId: string,
  originalName: string,
  contentType: string,
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const key = `parts-store/products/${productId}/${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );

  return `${CDN_ENDPOINT}/${key}`;
}

/**
 * Delete a product image from DigitalOcean Spaces.
 * Parses the object key from the CDN URL.
 */
export async function deleteProductImage(imageUrl: string): Promise<void> {
  // Extract key from CDN URL: https://316-garage-uploads.nyc3.digitaloceanspaces.com/parts-store/products/...
  const cdnPrefix = `${CDN_ENDPOINT}/`;
  let key: string;

  if (imageUrl.startsWith(cdnPrefix)) {
    key = imageUrl.slice(cdnPrefix.length);
  } else {
    // Try to extract from path-style URL
    const url = new URL(imageUrl);
    key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
}
