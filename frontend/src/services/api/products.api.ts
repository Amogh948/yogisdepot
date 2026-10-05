import type { Category, Pagination, Product } from "../../types";
import { api, unwrap } from "./client";

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  vendor?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  rating?: number;
  vegetarian?: string;
  vegan?: string;
  featured?: string;
  inStock?: string;
  brand?: string;
  discount?: string;
}

export const productsApi = {
  list: async (params: ProductQuery) => {
    const result = await unwrap<Product[]>(api.get("/products", { params }));
    return { items: result.data, pagination: result.pagination as Pagination };
  },
  bySlug: (slug: string) => unwrap<Product>(api.get(`/products/${slug}`)),
  related: (id: string) => unwrap<Product[]>(api.get(`/products/${id}/related`)),
};

export type MerchandisingRail = {
  id: string;
  name: string;
  slug: string;
  subtitle?: string;
  placement: string;
  image?: string;
  sortOrder: number;
  products: Product[];
};

export const merchandisingApi = {
  list: (placement?: string) =>
    unwrap<MerchandisingRail[]>(api.get("/merchandising", { params: placement ? { placement } : undefined })),
};

export const categoriesApi = {
  tree: () => unwrap<Category[]>(api.get("/categories")),
  bySlug: (slug: string) => unwrap<Category>(api.get(`/categories/${slug}`)),
};
