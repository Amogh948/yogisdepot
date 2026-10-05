import { ConflictError, NotFoundError } from "../../errors/AppError";
import { Category } from "../../models/Category";
import { uniqueSlug } from "../../utils/slug";

export const categoryService = {
  async create(input: {
    name: string;
    description?: string;
    image?: string;
    parentId?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const slug = uniqueSlug(input.name);
    if (input.parentId) {
      const parent = await Category.findById(input.parentId);
      if (!parent) {
        throw new NotFoundError("Parent category not found");
      }
    }
    return Category.create({
      ...input,
      slug,
      parentId: input.parentId || null,
    });
  },

  async update(id: string, input: Record<string, unknown>) {
    const category = await Category.findByIdAndUpdate(id, input, { new: true });
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    return category;
  },

  async remove(id: string) {
    const category = await Category.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    return category;
  },

  async getById(id: string) {
    const category = await Category.findById(id).populate("parentId", "name slug");
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    return category;
  },

  async getBySlug(slug: string) {
    const category = await Category.findOne({ slug, isActive: true });
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    return category;
  },

  async tree(activeOnly = true) {
    const filter = activeOnly ? { isActive: true } : {};
    const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
    const byParent = new Map<string, typeof categories>();
    for (const cat of categories) {
      const key = cat.parentId ? String(cat.parentId) : "root";
      const list = byParent.get(key) ?? [];
      list.push(cat);
      byParent.set(key, list);
    }
    const attach = (parentKey: string): Array<Record<string, unknown>> => {
      const children = byParent.get(parentKey) ?? [];
      return children.map((child) => ({
        ...child,
        id: String(child._id),
        children: attach(String(child._id)),
      }));
    };
    return attach("root");
  },

  async listFlat() {
    return Category.find().sort({ name: 1 });
  },

  async ensureUniqueName(_name: string) {
    const exists = await Category.findOne({ name: _name });
    if (exists) {
      throw new ConflictError("Category already exists");
    }
  },
};
