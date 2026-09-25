import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env";
import { BadRequestError } from "../../errors/AppError";
import { StorageProvider, StoredFile } from "./storage.service";

function configure(): void {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new BadRequestError("Cloudinary is not configured");
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export class CloudinaryStorageProvider implements StorageProvider {
  async save(file: Express.Multer.File): Promise<StoredFile> {
    configure();
    const uploaded = await new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "yogisdepot",
          resource_type: "image",
        },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Cloudinary upload failed"));
            return;
          }
          resolve({ public_id: result.public_id, secure_url: result.secure_url });
        },
      );
      stream.end(file.buffer);
    });
    return {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      mimeType: file.mimetype,
      originalName: file.originalname,
    };
  }

  async remove(publicId: string): Promise<void> {
    configure();
    await cloudinary.uploader.destroy(publicId);
  }

  async retrieve(publicId: string): Promise<{ url: string; publicId: string; bytes: number; format: string }> {
    configure();
    const resource = await cloudinary.api.resource(publicId);
    return {
      url: resource.secure_url as string,
      publicId: resource.public_id as string,
      bytes: resource.bytes as number,
      format: resource.format as string,
    };
  }
}

export async function retrieveCloudinaryFile(publicId: string) {
  return new CloudinaryStorageProvider().retrieve(publicId);
}
