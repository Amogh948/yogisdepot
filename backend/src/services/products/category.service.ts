import { Types } from "mongoose";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/AppError";
import { Category } from "../../models/Category";
import { Product } from "../../models/Product";
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

  async update(
    id: string,
    input: {
      name?: string;
      description?: string;
      image?: string;
      parentId?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    if (input.parentId) {
      if (input.parentId === id) {
        throw new BadRequestError("A category cannot be its own parent");
      }
      const parent = await Category.findById(input.parentId);
      if (!parent) {
        throw new NotFoundError("Parent category not found");
      }
    }

    if (input.name !== undefined && input.name !== category.name) {
      category.name = input.name;
      category.slug = uniqueSlug(input.name);
    }
    if (input.description !== undefined) category.description = input.description;
    if (input.image !== undefined) category.image = input.image;
    if (input.parentId !== undefined) category.parentId = (input.parentId || null) as never;
    if (input.isActive !== undefined) category.isActive = input.isActive;
    if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;

    await category.save();
    return this.getById(id);
  },

  async remove(id: string) {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    const descendantIds = await this.collectDescendantIds(String(category._id));
    const categoryIds = [category._id, ...descendantIds];

    const productCount = await Product.countDocuments({
      $or: [{ categoryId: { $in: categoryIds } }, { subCategoryId: { $in: categoryIds } }],
    });

    if (productCount > 0) {
      throw new BadRequestError(
        `Cannot delete category with ${productCount} product${productCount === 1 ? "" : "s"} in it or its subcategories. Remove or reassign products first.`,
      );
    }

    await Category.deleteMany({ _id: { $in: categoryIds } });
    return category;
  },

  async collectDescendantIds(parentId: string) {
    const ids: Types.ObjectId[] = [];
    let frontier = [new Types.ObjectId(parentId)];
    while (frontier.length) {
      const children = await Category.find({ parentId: { $in: frontier } }).select("_id");
      frontier = children.map((child) => child._id as Types.ObjectId);
      ids.push(...frontier);
    }
    return ids;
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
