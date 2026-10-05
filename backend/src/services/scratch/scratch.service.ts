import { randomBytes } from "crypto";
import { BadRequestError, NotFoundError } from "../../errors/AppError";
import { ScratchCampaign } from "../../models/ScratchCampaign";
import { UserScratchReward } from "../../models/UserScratchReward";

function pickRewardIndex(rewards: { probability: number; usageLimit?: number; usageCount: number }[]): number {
  const eligible = rewards
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => !r.usageLimit || r.usageCount < r.usageLimit);
  if (eligible.length === 0) {
    throw new BadRequestError("No scratch rewards remaining");
  }
  const total = eligible.reduce((s, e) => s + e.r.probability, 0);
  if (total <= 0) {
    throw new BadRequestError("Scratch campaign is misconfigured");
  }
  let roll = Math.random() * total;
  for (const entry of eligible) {
    roll -= entry.r.probability;
    if (roll <= 0) return entry.index;
  }
  return eligible[eligible.length - 1].index;
}

function rewardCode(): string {
  return `SCR-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export const scratchService = {
  async activeCampaign() {
    const now = new Date();
    return ScratchCampaign.findOne({
      status: "active",
      startAt: { $lte: now },
      endAt: { $gte: now },
    });
  },

  /**
   * Scratch once per user per campaign. Refresh returns the same persisted reward.
   */
  async scratch(userId: string, campaignId?: string) {
    const campaign = campaignId
      ? await ScratchCampaign.findById(campaignId)
      : await this.activeCampaign();
    if (!campaign || campaign.status !== "active") {
      throw new NotFoundError("No active scratch campaign");
    }
    const now = new Date();
    if (now < campaign.startAt || now > campaign.endAt) {
      throw new BadRequestError("Scratch campaign is not active");
    }

    const existing = await UserScratchReward.findOne({ userId, campaignId: campaign._id });
    if (existing) {
      return existing;
    }

    const index = pickRewardIndex(campaign.rewards);
    const reward = campaign.rewards[index];
    if (!reward) throw new BadRequestError("Unable to select reward");

    const expiresAt = new Date(Math.min(campaign.endAt.getTime(), now.getTime() + 30 * 24 * 60 * 60 * 1000));
    try {
      const issued = await UserScratchReward.create({
        userId,
        campaignId: campaign._id,
        rewardId: reward._id,
        code: rewardCode(),
        label: reward.label,
        discountType: reward.discountType,
        discountValue: reward.discountValue,
        maximumDiscountCents: reward.maximumDiscountCents,
        minimumOrderValueCents: reward.minimumOrderValueCents,
        status: "issued",
        expiresAt,
      });
      reward.usageCount += 1;
      await campaign.save();
      return issued;
    } catch (error) {
      // Unique user+campaign race: return the persisted reward
      const raced = await UserScratchReward.findOne({ userId, campaignId: campaign._id });
      if (raced) return raced;
      throw error;
    }
  },

  async listForUser(userId: string) {
    return UserScratchReward.find({ userId }).sort({ createdAt: -1 });
  },

  async markRedeemed(rewardId: string, userId: string, orderId: string) {
    const reward = await UserScratchReward.findOne({ _id: rewardId, userId, status: "issued" });
    if (!reward) throw new BadRequestError("Scratch reward cannot be redeemed");
    if (reward.expiresAt.getTime() < Date.now()) {
      reward.status = "expired";
      await reward.save();
      throw new BadRequestError("Scratch reward has expired");
    }
    reward.status = "redeemed";
    reward.redeemedAt = new Date();
    reward.redeemedOrderId = orderId as unknown as typeof reward.redeemedOrderId;
    await reward.save();
    return reward;
  },
};
