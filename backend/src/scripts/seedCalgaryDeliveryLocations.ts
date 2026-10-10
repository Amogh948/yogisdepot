/**
 * Upsert Calgary (AB) delivery areas with postal prefixes and delivery fees.
 * Run: npx tsx src/scripts/seedCalgaryDeliveryLocations.ts
 */
import { connectDatabase, disconnectDatabase } from "../config/database";
import { DeliveryLocation } from "../models/DeliveryLocation";
import { logger } from "../utils/logger";

const DEFAULT_FEE_CENTS = 499;
const DEFAULT_SUPERFAST_FEE_CENTS = 999;

const CALGARY_AREAS = [
  {
    postalCodePrefix: "T2W",
    areaNames: ["Braeside", "Cedarbrae", "Woodbine", "Canyon Meadows", "Acadia/Pump Hill/Oakridge areas"],
  },
  {
    postalCodePrefix: "T2X",
    areaNames: ["Midnapore", "Sundance"],
  },
  {
    postalCodePrefix: "T2Y",
    areaNames: ["Millrise", "Somerset", "Bridlewood", "Evergreen"],
  },
  {
    postalCodePrefix: "T2Z",
    areaNames: [
      "Legacy",
      "Cranston/Seton adjacent industrial/residential",
      "Parkland",
      "Douglasdale/East Electric park zones",
    ],
  },
  {
    postalCodePrefix: "T2J",
    areaNames: ["Lake Bonavista", "Queensland", "Willow Park", "Acadia"],
  },
  {
    postalCodePrefix: "T3M",
    areaNames: ["Cranston", "Mahogany", "Auburn Bay"],
  },
] as const;

async function seedCalgaryDeliveryLocations() {
  await connectDatabase();

  for (const [index, area] of CALGARY_AREAS.entries()) {
    const postalCodePrefix = area.postalCodePrefix.toUpperCase();
    await DeliveryLocation.findOneAndUpdate(
      { postalCodePrefix },
      {
        $set: {
          name: postalCodePrefix,
          country: "Canada",
          province: "AB",
          city: "Calgary",
          postalCodePrefix,
          areaNames: [...area.areaNames],
          deliveryFeeCents: DEFAULT_FEE_CENTS,
          superfastDeliveryFeeCents: DEFAULT_SUPERFAST_FEE_CENTS,
          isActive: true,
          sortOrder: index + 1,
        },
      },
      { upsert: true, new: true },
    );
    logger.info(`Upserted delivery area ${postalCodePrefix}`);
  }

  const count = await DeliveryLocation.countDocuments({
    postalCodePrefix: { $in: CALGARY_AREAS.map((a) => a.postalCodePrefix) },
  });
  logger.info(`Calgary delivery areas ready (${count})`);
  await disconnectDatabase();
}

seedCalgaryDeliveryLocations().catch(async (error) => {
  logger.error(error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
