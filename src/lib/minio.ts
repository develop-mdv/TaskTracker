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

function formatUrlForClient(url: string) {
    if (process.env.MINIO_ENDPOINT === "minio") {
        const publicUrl = process.env.MINIO_PUBLIC_URL || "localhost";
        // MinIO generates http://minio:9000 -> replace minio to publicUrl
        return url.replace(`//minio:`, `//${publicUrl}:`);
    }
    return url;
}

export async function getUploadUrl(
    key: string,
    contentType?: string
): Promise<string> {
    await ensureBucket();
    // Presigned PUT URL valid for 1 hour
    const url = await minioClient.presignedPutObject(BUCKET, key, 3600);
    return formatUrlForClient(url);
}

export async function getDownloadUrl(key: string, downloadFilename?: string): Promise<string> {
    const reqParams: { [key: string]: any } = {};
    if (downloadFilename) {
        const encodedName = encodeURIComponent(downloadFilename);
        reqParams["response-content-disposition"] = `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`;
    } else {
        reqParams["response-content-disposition"] = `inline`;
    }
    
    // Presigned GET URL valid for 1 hour
    const url = await minioClient.presignedGetObject(BUCKET, key, 3600, reqParams);
    return formatUrlForClient(url);
}

export async function deleteObject(key: string): Promise<void> {
    await minioClient.removeObject(BUCKET, key);
}

export { minioClient, BUCKET };
