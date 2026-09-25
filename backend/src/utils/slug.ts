export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base.length > 0 ? base : "item";
}

export function uniqueSlug(value: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slugify(value)}-${suffix}`;
}
