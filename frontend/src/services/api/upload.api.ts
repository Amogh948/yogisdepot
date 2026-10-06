import { api, unwrap } from "./client";

export type StoredUpload = {
  url: string;
  publicId: string;
  mimeType: string;
  originalName: string;
};

export const uploadApi = {
  upload: async (files: File[]) => {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file);
    }
    const result = await unwrap<StoredUpload[]>(
      api.post("/uploads", form, {
        // Let the browser set multipart boundary; override instance JSON default.
        headers: { "Content-Type": undefined as unknown as string },
        transformRequest: [
          (data, headers) => {
            if (data instanceof FormData && headers) {
              delete (headers as Record<string, unknown>)["Content-Type"];
            }
            return data;
          },
        ],
      }),
    );
    return result.data;
  },
};
