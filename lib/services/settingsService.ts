import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";

const QUOTE_SETTINGS_ID = "singleton";
const QUOTE_SETTINGS_TAG = "quote-settings";

const decimalFromNumber = (value: number) =>
  new Prisma.Decimal(Number(value ?? 0).toFixed(2));

async function ensureQuoteSettingsRow() {
  const existing = await prisma.quoteSettings.findUnique({
    where: { id: QUOTE_SETTINGS_ID },
  });

  if (existing) {
    return existing;
  }

  const defaultOverhead = Number(process.env.DEFAULT_OVERHEAD_FEE ?? 0);
  return prisma.quoteSettings.create({
    data: {
      id: QUOTE_SETTINGS_ID,
      overheadFee: decimalFromNumber(defaultOverhead),
      updatedBy: "system",
    },
  });
}

const getQuoteSettingsCached = unstable_cache(
  async () => ensureQuoteSettingsRow(),
  [QUOTE_SETTINGS_TAG],
  { revalidate: false, tags: [QUOTE_SETTINGS_TAG] },
);

export const settingsService = {
  async getQuoteSettings() {
    return getQuoteSettingsCached();
  },

  async updateQuoteSettings(input: { overheadFee: number; updatedBy?: string | null }) {
    await ensureQuoteSettingsRow();

    const record = await prisma.quoteSettings.update({
      where: { id: QUOTE_SETTINGS_ID },
      data: {
        overheadFee: decimalFromNumber(input.overheadFee),
        updatedBy: input.updatedBy ?? null,
      },
    });

    (revalidateTag as any)(QUOTE_SETTINGS_TAG);
    return record;
  },
};


