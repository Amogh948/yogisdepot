import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { env } from "../../config/env";
import { CloudinaryStorageProvider, retrieveCloudinaryFile } from "./cloudinary.provider";

export interface StoredFile {
  url: string;
  publicId: string;
  mimeType: string;
  originalName: string;
}

export interface StorageProvider {
  save(file: Express.Multer.File): Promise<StoredFile>;
  remove(publicId: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  private readonly directory: string;

  constructor() {
    this.directory = path.resolve(process.cwd(), env.UPLOAD_DIR);
  }

  async save(file: Express.Multer.File): Promise<StoredFile> {
    await fs.mkdir(this.directory, { recursive: true });
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const publicId = `${randomUUID()}${ext}`;
    await fs.writeFile(path.join(this.directory, publicId), file.buffer);
    return {
      url: `/uploads/${publicId}`,
      publicId,
      mimeType: file.mimetype,
      originalName: file.originalname,
    };
  }

  async remove(publicId: string): Promise<void> {
    const target = path.join(this.directory, path.basename(publicId));
    await fs.unlink(target).catch(() => undefined);
  }
}

export function getStorageProvider(): StorageProvider {
  if (env.STORAGE_DRIVER === "cloudinary") {
    return new CloudinaryStorageProvider();
  }
  return new LocalStorageProvider();
}

export async function saveUploadedFiles(files: Express.Multer.File[]): Promise<StoredFile[]> {
  const provider = getStorageProvider();
  const stored: StoredFile[] = [];
  for (const file of files) {
    stored.push(await provider.save(file));
  }
  return stored;
}

export async function retrieveUploadedFile(publicId: string) {
  if (env.STORAGE_DRIVER === "cloudinary") {
    return retrieveCloudinaryFile(publicId);
  }
  return {
    url: `/uploads/${path.basename(publicId)}`,
    publicId,
    bytes: 0,
    format: path.extname(publicId).replace(".", ""),
  };
}
