import { Request, Response } from "express";
import { scratchService } from "../../services/scratch/scratch.service";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const scratchController = {
  scratch: asyncHandler(async (req: Request, res: Response) => {
    const reward = await scratchService.scratch(req.user!.id, req.body.campaignId);
    sendSuccess(res, {
      id: reward.id,
      code: reward.code,
      label: reward.label,
      discountType: reward.discountType,
      // Never trust client amounts — expose configured fields for display only
      discountValue: reward.discountValue,
      maximumDiscountCents: reward.maximumDiscountCents,
      minimumOrderValueCents: reward.minimumOrderValueCents,
      status: reward.status,
      expiresAt: reward.expiresAt,
    }, "Scratch reward issued");
  }),

  rewards: asyncHandler(async (req: Request, res: Response) => {
    const rewards = await scratchService.listForUser(req.user!.id);
    sendSuccess(res, rewards, "Scratch rewards fetched");
  }),

  activeCampaign: asyncHandler(async (_req: Request, res: Response) => {
    const campaign = await scratchService.activeCampaign();
    if (!campaign) {
      sendSuccess(res, null, "No active campaign");
      return;
    }
    sendSuccess(
      res,
      {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
      },
      "Active campaign",
    );
  }),
};
