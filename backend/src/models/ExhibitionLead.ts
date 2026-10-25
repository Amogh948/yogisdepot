import mongoose, { Document, Model, Schema } from "mongoose";

export const CALGARY_QUADRANTS = ["NW", "NE", "SW", "SE", "Other"] as const;
export type CalgaryQuadrant = (typeof CALGARY_QUADRANTS)[number];

export interface ExhibitionLeadDocument extends Document {
  name: string;
  phone: string;
  email: string;
  quadrant: CalgaryQuadrant;
  createdAt: Date;
  updatedAt: Date;
}

const exhibitionLeadSchema = new Schema<ExhibitionLeadDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    quadrant: { type: String, enum: CALGARY_QUADRANTS, required: true },
  },
  { timestamps: true },
);

exhibitionLeadSchema.index({ createdAt: -1 });
exhibitionLeadSchema.index({ email: 1, createdAt: -1 });

exhibitionLeadSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const json = ret as unknown as Record<string, unknown>;
    json.id = String(json._id);
    delete json._id;
    delete json.__v;
    return json;
  },
});

export const ExhibitionLead: Model<ExhibitionLeadDocument> =
  mongoose.models.ExhibitionLead ||
  mongoose.model<ExhibitionLeadDocument>("ExhibitionLead", exhibitionLeadSchema);
