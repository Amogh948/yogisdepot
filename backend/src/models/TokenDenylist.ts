import mongoose, { Document, Model, Schema } from "mongoose";

export interface TokenDenylistDocument extends Document {
  jti: string;
  expiresAt: Date;
}

const tokenDenylistSchema = new Schema<TokenDenylistDocument>({
  jti: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

tokenDenylistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
tokenDenylistSchema.index({ jti: 1 }, { unique: true });

export const TokenDenylist: Model<TokenDenylistDocument> =
  mongoose.models.TokenDenylist ||
  mongoose.model<TokenDenylistDocument>("TokenDenylist", tokenDenylistSchema);
