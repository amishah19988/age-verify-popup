import prisma from "../db.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }) => {
  try {
    const miUrl = new URL(request.url);
    const shop = miUrl.searchParams.get("shop");

    if (!shop) {
      return json({ error: "Shop parameter is missing" }, { status: 400 });
    }

    const settings = await prisma.ageVerificationSettings.findFirst({
      where: { shop },
    });

    if (!settings) {
      return json({ error: "Settings not found for this shop" }, { status: 404 });
    }

    return json({
      status: settings.status,
      verificationType: settings.verificationType,
      ageLimit: settings.ageLimit,
      linkTitle: settings.linkTitle,
      anchorText: settings.anchorText,
      anchorUrl: settings.anchorUrl,
      textColor: settings.textColor,
      buttonLabelLeft: settings.buttonLabelLeft,
      buttonLeftBackgroundColor: settings.buttonLeftBackgroundColor,
      buttonLeftTextColor: settings.buttonLeftTextColor,
      buttonLabelRight: settings.buttonLabelRight,
      buttonRightBackgroundColor: settings.buttonRightBackgroundColor,
      buttonRightTextColor: settings.buttonRightTextColor,
      popupTitle: settings.popupTitle,
      contentTitle: settings.contentTitle,
      contentTitleColor: settings.contentTitleColor,
      contentSubtitle: settings.contentSubtitle,
      contentSubtitleColor: settings.contentSubtitleColor,
      headerBackgroundColor: settings.headerBackgroundColor,
      bodyBackgroundColor: settings.bodyBackgroundColor,
      iconImage: settings.iconImage,
      underAgeNoticeType: settings.underAgeNoticeType,
      underAgeMessage: settings.underAgeMessage,
      redirectUrl: settings.redirectUrl,
      cookieLifetime: settings.cookieLifetime,
    }, { status: 200 });
  } catch (error) {
    return json({ error: "Internal server error" }, { status: 500 });
  }
};