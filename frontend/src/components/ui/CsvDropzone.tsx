import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, Upload, X } from "lucide-react";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CsvDropzone({
  file,
  onFile,
  disabled,
  hint = "CSV up to 5 MB",
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const next = accepted[0];
      if (next) onFile(next);
    },
    [onFile],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
      "text/plain": [".csv"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    disabled,
    noClick: Boolean(file),
    noKeyboard: Boolean(file),
    multiple: false,
  });

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-yd-green/30 bg-yd-green/5 px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-yd-green shadow-soft">
          <FileSpreadsheet className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-yd-ink">{file.name}</p>
          <p className="text-xs text-yd-muted">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          className="grid h-9 w-9 place-items-center rounded-full text-yd-muted hover:bg-white hover:text-yd-error disabled:opacity-50"
          onClick={() => onFile(null)}
          aria-label="Remove file"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
        isDragReject
          ? "border-yd-error/50 bg-yd-error/5"
          : isDragActive
            ? "border-yd-green bg-yd-green/5"
            : "border-yd-border bg-yd-cream/40 hover:border-yd-green/40 hover:bg-yd-green/5"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input {...getInputProps()} />
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-white text-yd-green shadow-soft">
        <Upload className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-yd-ink">
        {isDragActive ? "Drop CSV here" : "Drag & drop your CSV"}
      </p>
      <p className="mt-1 text-xs text-yd-muted">{hint}</p>
      <button
        type="button"
        disabled={disabled}
        className="mt-3 text-sm font-semibold text-yd-green hover:underline"
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
      >
        Browse files
      </button>
    </div>
  );
}
