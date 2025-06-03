import { json, redirect } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
  useNavigate,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Spinner,
  List,
  Frame,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import React, { useEffect, useState } from "react";
import prisma from "../db.server";
import NavigationBar from './NavigationBar';

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const existingAccount = await prisma.account.findFirst({
      where: { shop },
    });

    return json({
      shop,
      existingAccount,
    });
  } catch (error) {
    if (!error.response) {
      return redirect("/auth");
    }
    return json({ shop: null, existingAccount: null });
  }
};

export const action = async ({ request }) => {
  try {
    if (!prisma) {
      throw new Error("Prisma client is not initialized");
    }

    if (!prisma.account) {
      throw new Error("Account model is not available on Prisma client");
    }

    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const username = formData.get("username");
    const email = formData.get("email");
    const shop = session.shop;

    if (!username || !email || !shop) {
      return json(
        { success: false, error: "All fields (username, email, shop) are required" },
        { status: 400 }
      );
    }

    const existingAccount = await prisma.account.findFirst({
      where: { shop },
    });

    if (existingAccount) {
      return json(
        {
          success: true,
          account: existingAccount,
          message: "Account already exists for this shop",
        },
        { status: 200 }
      );
    }

    const serialkey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const account = await prisma.account.create({
      data: {
        username,
        email,
        serialkey,
        shop,
      },
    });

    return json({ success: true, account }, { status: 200 });
  } catch (error) {
    if (error.code === "P2002") {
      return json(
        {
          success: false,
          error: "Username, email, or serialkey already exists",
        },
        { status: 400 }
      );
    }
    return json(
      {
        success: false,
        error: "An error occurred while creating the account",
        details: error.message,
      },
      { status: 500 }
    );
  }
};

// Use PascalCase for React component
const MiFullScreenLoader = () => (
  <div
    style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2000,
    }}
  >
    <Spinner accessibilityLabel="Loading" size="large" />
  </div>
);

export default function AgeVerificationPopup() {
  const { shop, existingAccount: miInitialAccount } = useLoaderData();
  const miActionData = useActionData();
  const miFetcher = useFetcher();
  const miShopify = useAppBridge();
  const miNavigation = useNavigation();
  const miNavigate = useNavigate();
  const [miAccount, miSetAccount] = useState({ username: "", email: "" });
  const [miCreatedAccount, miSetCreatedAccount] = useState(miInitialAccount);
  const [miEmailError, miSetEmailError] = useState("");
  const [miIsGuideOpen, miSetIsGuideOpen] = useState(false);
  // Include both submitting and loading states for miIsLoading
  const miIsLoading =
    ["loading", "submitting"].includes(miFetcher.state) ||
    ["loading", "submitting"].includes(miNavigation.state);

  useEffect(() => {
    if (shop) {
      sessionStorage.setItem("shop", shop);
    }
  }, [shop]);

  useEffect(() => {
    if (miActionData?.success && miActionData.account) {
      miSetCreatedAccount(miActionData.account);
      miSetAccount({ username: "", email: "" });
      miSetEmailError("");
    }
  }, [miActionData]);

  const miValidateEmail = (email) => {
    const miEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return "Email is required";
    }
    if (!miEmailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const miHandleEmailChange = (value) => {
    miSetAccount({ ...miAccount, email: value });
    miSetEmailError(miValidateEmail(value));
  };

  const miHandleRedirect = () => {
    if (!miCreatedAccount) {
      miShopify.toast.show("Please create account first");
      return;
    }
    const miShopDomain = shop || sessionStorage.getItem("shop");
    if (miShopDomain) {
      const miStoreName = miShopDomain.split(".")[0];
      window.open(
        `https://admin.shopify.com/store/${miStoreName}/themes/current/editor?context=apps`,
        "_blank"
      );
    } else {
      miShopify.toast.show(
        "Could not determine your shop name. Please navigate to your theme editor manually to enable theme block."
      );
    }
  };

  return (
    <Page>
      <TitleBar title="Age Verification Popup" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <NavigationBar />
            <div
              style={{
                backgroundImage: "url('/banner_image.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                height: "200px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                textAlign: "center",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            />
            {/* Show "Create Account" button below banner if no account exists */}
            {!miCreatedAccount && (
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    No Account Found
                  </Text>
                  <Text as="p" tone="subdued">
                    Create an account to start configuring the age verification popup.
                  </Text>
                  <div style={{ width: "150px" }}>
                    <Button
                      variant="primary"
                      size="slim"
                      onClick={() => miNavigate("/app/settings")}
                      disabled={miIsLoading}
                      fullWidth // Ensures the button spans the container's width
                    >
                      Create Account
                    </Button>
                  </div>
                </BlockStack>
              </Card>
            )}
          </Layout.Section>

          {miCreatedAccount && (
            <Layout.Section>
              <Card>
                <div
                  onClick={() => miSetIsGuideOpen(!miIsGuideOpen)}
                  style={{
                    cursor: "pointer",
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <img src="/guide.svg" alt="Guide" style={{ width: "40px", height: "40px" }} />
                    <Text as="h2" variant="headingMd">
                      Setup Guide: Get Started with Age Verification Popup
                    </Text>
                  </div>
                  <button
                    className="Polaris-Button Polaris-Button--pressable Polaris-Button--variantSecondary Polaris-Button--sizeMedium Polaris-Button--textAlignCenter"
                    type="button"
                    onClick={() => miSetIsGuideOpen(!miIsGuideOpen)}
                  >
                    <span className="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">
                      <span className="Polaris-Icon">
                        <svg
                          viewBox="0 0 20 20"
                          className="Polaris-Icon__Svg"
                          focusable="false"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.72 8.47a.75.75 0 0 1 1.06 0l3.47 3.47 3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06Z"
                          />
                        </svg>
                      </span>
                    </span>
                  </button>
                </div>
                {miIsGuideOpen && (
                  <div style={{ padding: "0 1rem" }}>
                    <Text
                      as="p"
                      variant="bodyMd"
                      tone="subdued"
                      style={{ marginBottom: "1rem" }}
                    >
                      Follow these steps to set up and configure the age verification popup in your store, ensuring compliance with age-restricted content.
                    </Text>
                    <List type="number">
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          <strong>Enable Age Verification:</strong> Enable the Storefront integration to start. Embed the Age Verification Popup by clicking the button below or navigating to Online Store &gt; Themes &gt; Customize &gt; App Embeds, and save your settings after enabling the app block.
                        </Text>
                        <div style={{ marginTop: "0.5rem" }}>
                          <Button
                            onClick={miHandleRedirect}
                            variant="primary"
                            disabled={!miCreatedAccount || miIsLoading}
                          >
                            Enable theme block
                          </Button>
                        </div>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          <strong>Configure Age Verification Settings:</strong>{" "}
                          Set your preferred configuration on the Configuration page, such as age limit, popup message, and styling options for the age verification popup.
                        </Text>
                        <div style={{ marginTop: "0.5rem" }}>
                          <Button
                            onClick={() => miNavigate("/app/ageverification-config-settings")}
                            variant="primary"
                            disabled={miIsLoading}
                          >
                            Go to Configuration
                          </Button>
                        </div>
                      </List.Item>
                      <List.Item>
                        <Text as="span" variant="bodyMd">
                          <strong>Setup Rules:</strong> Define rules for when and how the age verification popup should appear, such as specific pages or user conditions, on the Rules page.
                        </Text>
                        <div style={{ marginTop: "0.5rem" }}>
                          <Button
                            onClick={() => miNavigate("/app/rules")}
                            variant="primary"
                            disabled={miIsLoading}
                          >
                            Go to Rules
                          </Button>
                        </div>
                      </List.Item>
                    </List>
                  </div>
                )}
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
      {miIsLoading && <MiFullScreenLoader />}
    </Page>
  );
}