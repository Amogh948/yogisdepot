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
  region?: string;
  festival?: string;
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
  tasteIndiaRegion?: string | null;
  image?: string;
  sortOrder: number;
  startDate?: string | null;
  endDate?: string | null;
  products: Product[];
};

export const merchandisingApi = {
  list: (placement?: string, opts?: { region?: string }) =>
    unwrap<MerchandisingRail[]>(
      api.get("/merchandising", { params: { placement, region: opts?.region } }),
    ),
  bySlug: (slug: string) => unwrap<MerchandisingRail>(api.get(`/merchandising/${slug}`)),
};

export type HomeSectionRail = {
  id: string;
  key: "bestsellers" | "deals" | "featured" | "new_arrivals";
  title: string;
  subtitle?: string;
  sortOrder: number;
  products: Product[];
};

export const homeSectionsApi = {
  list: () => unwrap<HomeSectionRail[]>(api.get("/home-sections")),
};

export type PublicBrand = {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
};

export const brandsApi = {
  list: () => unwrap<PublicBrand[]>(api.get("/brands")),
  bySlug: (slug: string) => unwrap<PublicBrand>(api.get(`/brands/${slug}`)),
};

export const categoriesApi = {
  tree: () => unwrap<Category[]>(api.get("/categories")),
  bySlug: (slug: string) => unwrap<Category>(api.get(`/categories/${slug}`)),
};
