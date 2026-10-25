import { Request, Response } from "express";
import { z } from "zod";
import { CALGARY_QUADRANTS, ExhibitionLead } from "../../models/ExhibitionLead";
import { NotFoundError } from "../../errors/AppError";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const exhibitionLeadSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .min(8, "Enter a valid phone number")
    .max(30)
    .refine((value) => value.replace(/\D/g, "").length >= 8, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(120),
  quadrant: z.enum(CALGARY_QUADRANTS),
  /** Honeypot — real visitors leave this blank. */
  company: z.string().max(200).optional(),
});

export const exhibitionLeadController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const { name, phone, email, quadrant, company } = req.body as z.infer<typeof exhibitionLeadSchema>;
    if (company?.trim()) {
      sendSuccess(res, { received: true }, "Thanks — you're on the list", 201);
      return;
    }
    await ExhibitionLead.create({
      name,
      phone,
      email: email.toLowerCase(),
      quadrant,
    });
    sendSuccess(res, { received: true }, "Thanks — you're on the list", 201);
  }),

  list: asyncHandler(async (_req: Request, res: Response) => {
    const leads = await ExhibitionLead.find().sort({ createdAt: -1 }).limit(1000);
    sendSuccess(res, leads, "Exhibition leads fetched");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const lead = await ExhibitionLead.findByIdAndDelete(req.params.id);
    if (!lead) throw new NotFoundError("Lead not found");
    sendSuccess(res, null, "Lead deleted");
  }),
};
