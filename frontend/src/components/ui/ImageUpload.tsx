import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadApi } from "../../services/api/upload.api";
import { ApiError } from "../../services/api/client";
import { mediaUrl } from "../../types";
import { useToastStore } from "../../store/toast.store";

type CommonProps = {
  label: string;
  hint?: string;
  disabled?: boolean;
};

type SingleProps = CommonProps & {
  multiple?: false;
  value: string;
  onChange: (url: string) => void;
  maxFiles?: 1;
};

type MultiProps = CommonProps & {
  multiple: true;
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
};

type ImageUploadProps = SingleProps | MultiProps;

export function ImageUpload(props: ImageUploadProps) {
  const { label, hint, disabled } = props;
  const multiple = Boolean(props.multiple);
  const maxFiles = props.maxFiles ?? (multiple ? 8 : 1);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToastStore((s) => s.push);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const urls = multiple ? (props.value as string[]) : props.value ? [props.value as string] : [];

  const commit = (next: string[]) => {
    if (props.multiple) {
      props.onChange(next.slice(0, maxFiles));
    } else {
      props.onChange(next[0] || "");
    }
  };

  const onPick = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    const selected = Array.from(files).slice(0, Math.max(0, maxFiles - urls.length));
    if (!selected.length) {
      toast(`You can upload up to ${maxFiles} image${maxFiles === 1 ? "" : "s"}`, "error");
      return;
    }
    setUploading(true);
    try {
      const stored = await uploadApi.upload(selected);
      const uploadedUrls = stored.map((item) => item.url).filter(Boolean);
      if (!uploadedUrls.length) throw new ApiError("Upload returned no image URL");
      commit(multiple ? [...urls, ...uploadedUrls] : uploadedUrls);
      toast(uploadedUrls.length > 1 ? "Images uploaded" : "Image uploaded");
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Could not upload image", "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    commit(urls.filter((_, i) => i !== index));
  };

  const addUrl = () => {
    const next = urlDraft.trim();
    if (!next) return;
    commit(multiple ? [...urls, next] : [next]);
    setUrlDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-yd-ink">{label}</span>
        {hint ? <span className="text-xs text-yd-muted">{hint}</span> : null}
      </div>

      {urls.length ? (
        <div className={`grid gap-2 ${multiple ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1"}`}>
          {urls.map((url, index) => (
            <div key={`${url}-${index}`} className="relative overflow-hidden rounded-xl border border-yd-border bg-yd-cream">
              <img
                src={mediaUrl(url)}
                alt=""
                className={multiple ? "aspect-square w-full object-cover" : "h-36 w-full object-cover"}
              />
              <button
                type="button"
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-yd-error shadow-soft"
                aria-label="Remove image"
                disabled={disabled || uploading}
                onClick={() => removeAt(index)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {urls.length < maxFiles ? (
        <label
          htmlFor={inputId}
          className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-yd-border bg-white px-4 py-5 text-center transition hover:border-yd-green/50 ${
            disabled || uploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-yd-green" />
          ) : (
            <ImagePlus className="h-5 w-5 text-yd-green" />
          )}
          <span className="text-sm font-semibold text-yd-ink">{uploading ? "Uploading…" : "Upload from computer"}</span>
          <span className="text-xs text-yd-muted">JPEG, PNG, WebP, or GIF</span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple={multiple && maxFiles > 1}
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(event) => void onPick(event.target.files)}
          />
        </label>
      ) : null}

      <div className="flex gap-2">
        <input
          type="url"
          value={urlDraft}
          disabled={disabled || uploading || urls.length >= maxFiles}
          placeholder="Or paste an image URL"
          className="h-10 min-w-0 flex-1 rounded-xl border border-yd-border bg-white px-3 text-sm outline-none ring-yd-green/40 focus:ring-2"
          onChange={(event) => setUrlDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addUrl();
            }
          }}
        />
        <button
          type="button"
          className="h-10 shrink-0 rounded-xl border border-yd-border px-3 text-sm font-semibold text-yd-ink disabled:opacity-50"
          disabled={disabled || uploading || !urlDraft.trim() || urls.length >= maxFiles}
          onClick={addUrl}
        >
          Add URL
        </button>
      </div>
    </div>
  );
}
