import * as Minio from "minio";

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const BUCKET = process.env.MINIO_BUCKET || "attachments";

export async function ensureBucket() {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
        await minioClient.makeBucket(BUCKET);
    }
}

export async function getUploadUrl(
    key: string,
    contentType?: string
): Promise<string> {
    await ensureBucket();
    // Presigned PUT URL valid for 1 hour
    const url = await minioClient.presignedPutObject(BUCKET, key, 3600);
    return url;
}

export async function getDownloadUrl(key: string): Promise<string> {
    // Presigned GET URL valid for 1 hour
    const url = await minioClient.presignedGetObject(BUCKET, key, 3600);
    return url;
}

export async function deleteObject(key: string): Promise<void> {
    await minioClient.removeObject(BUCKET, key);
}

export { minioClient, BUCKET };
