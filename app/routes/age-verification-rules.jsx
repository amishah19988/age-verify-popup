import prisma from "../db.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  try {
    const miUrl = new URL(request.url);
    const shop = miUrl.searchParams.get("shop");

    if (!shop) {
      return json({ error: "Shop parameter is missing" }, { status: 400 });
    }

    const rules = await prisma.ageVerificationRules.findFirst({
      where: { shop },
    });

    if (!rules) {
      return json({ visibility: 'specific', pageUrls: [] }, { status: 200 });
    }

    return json({
      visibility: rules.visibility,
      pageUrls: rules.pageUrls,
    }, { status: 200 });
  } catch (error) {
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};