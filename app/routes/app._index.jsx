import { json, redirect } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
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
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import prisma from "../db.server";
import { SettingOutlined } from "@ant-design/icons";

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

const FullScreenLoader = () => (
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
  const { shop, existingAccount: initialAccount } = useLoaderData();
  const actionData = useActionData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [account, setAccount] = useState({ username: "", email: "" });
  const [createdAccount, setCreatedAccount] = useState(initialAccount);
  const [emailError, setEmailError] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) ||
    navigation.state === "submitting" ||
    navigation.state === "loading";

  useEffect(() => {
    if (shop) {
      sessionStorage.setItem("shop", shop);
    }
  }, [shop]);

  useEffect(() => {
    if (actionData?.success && actionData.account) {
      setCreatedAccount(actionData.account);
      setAccount({ username: "", email: "" });
      setEmailError("");
    }
  }, [actionData]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return "Email is required";
    }
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const handleEmailChange = (value) => {
    setAccount({ ...account, email: value });
    setEmailError(validateEmail(value));
  };

  const handleRedirect = () => {
    if (!createdAccount) {
      shopify.toast.show("Please create account first");
      return;
    }
    const shopDomain = shop || sessionStorage.getItem("shop");
    if (shopDomain) {
      const storeName = shopDomain.split(".")[0];
      window.open(
        `https://admin.shopify.com/store/${storeName}/themes/current/editor?context=apps`,
        "_blank"
      );
    } else {
      shopify.toast.show(
        "Could not determine your shop name. Please navigate to your theme editor manually to enable theme block."
      );
    }
  };

  return (
    <Page>
      <TitleBar title="Age Verification Popup" />
      <BlockStack gap="500">
        <Layout>
          {/* Guide Block Section */}
          {createdAccount && (
            <Layout.Section>
              <Card>
                <div
                  onClick={() => setIsGuideOpen(!isGuideOpen)}
                  style={{
                    cursor: "pointer",
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text as="h2" variant="headingMd">
                    Get Started with Age Verification Popup
                  </Text>
                  <SettingOutlined style={{ fontSize: "20px", color: "#555" }} />
                </div>
                {isGuideOpen && (
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
                            onClick={handleRedirect}
                            variant="primary"
                            disabled={!createdAccount || isLoading}
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
                            onClick={() => navigate("/app/ageverification-config-settings")}
                            variant="primary"
                            disabled={isLoading}
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
                            onClick={() => navigate("/app/rules")}
                            variant="primary"
                            disabled={isLoading}
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

          {/* Account Section */}
          <Layout.Section>
            <Card>
              <div
                onClick={() => setIsAccountOpen(!isAccountOpen)}
                style={{
                  cursor: "pointer",
                  padding: "1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f5f5f5",
                  borderRadius: "5px",
                }}
              >
                <Text as="h2" variant="headingMd">
                  Account
                </Text>
                <SettingOutlined style={{ fontSize: "20px", color: "#555" }} />
              </div>
              {isAccountOpen && (
                <div style={{ marginTop: "1rem", padding: "1rem" }}>
                  {createdAccount ? (
                    <BlockStack gap="200">
                      <Text as="h4" variant="headingSm">
                        Account Details
                      </Text>
                      <Text as="p" variant="bodyMd">
                        <strong>Username:</strong> {createdAccount.username}
                      </Text>
                      <Text as="p" variant="bodyMd">
                        <strong>Email:</strong> {createdAccount.email}
                      </Text>
                      <Text as="p" variant="bodyMd">
                        <strong>Serial Key:</strong> {createdAccount.serialkey}
                      </Text>
                      <Text as="p" variant="bodyMd">
                        <strong>Shop:</strong> {createdAccount.shop}
                      </Text>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Add Account Details
                      </Text>
                      <Form method="post">
                        <input type="hidden" name="shop" value={shop} />
                        <div style={{ marginBottom: "1rem" }}>
                          <label
                            htmlFor="username"
                            style={{ display: "block", marginBottom: "0.5rem" }}
                          >
                            Username
                          </label>
                          <input
                            id="username"
                            type="text"
                            name="username"
                            placeholder="Username"
                            required
                            value={account.username}
                            onChange={(e) =>
                              setAccount({ ...account, username: e.target.value })
                            }
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "5px",
                              border: "1px solid #ddd",
                            }}
                          />
                        </div>

                        <div style={{ marginBottom: "1rem" }}>
                          <label
                            htmlFor="email"
                            style={{ display: "block", marginBottom: "0.5rem" }}
                          >
                            Email
                          </label>
                          <input
                            id="email"
                            type="email"
                            name="email"
                            placeholder="Email"
                            required
                            value={account.email}
                            onChange={(e) => handleEmailChange(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: "5px",
                              border: `1px solid ${emailError ? "#ff0000" : "#ddd"}`,
                            }}
                          />
                          {emailError && (
                            <Text
                              as="p"
                              tone="critical"
                              style={{ marginTop: "0.5rem" }}
                            >
                              {emailError}
                            </Text>
                          )}
                        </div>

                        {actionData?.error && (
                          <Text
                            as="p"
                            tone="critical"
                            style={{ marginBottom: "1rem" }}
                          >
                            {actionData.error}
                          </Text>
                        )}

                        <Button
                          variant="primary"
                          submit
                          disabled={
                            !account.username ||
                            !account.email ||
                            emailError ||
                            isLoading
                          }
                          loading={isLoading}
                        >
                          Save Account
                        </Button>
                      </Form>
                    </BlockStack>
                  )}
                </div>
              )}
            </Card>
          </Layout.Section>

          {/* Configuration Section */}
          <Layout.Section>
            <Card>
              <Text as="h2" variant="headingMd">
                Configuration
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Go to Configuration Page
              </Text>
              <div style={{ marginTop: "1rem" }}>
                <Button
                  onClick={() => navigate("/app/ageverification-config-settings")}
                  variant="primary"
                  disabled={isLoading}
                  loading={isLoading}
                >
                  Configuration
                </Button>
              </div>
            </Card>
          </Layout.Section>

          {/* Quick Actions Section */}
          <Layout.Section>
            <Card>
              <Text as="h3" variant="headingSm">
                Quick Actions
              </Text>
              <div style={{ marginTop: "1rem" }}>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/app/settings")}
                  disabled={isLoading}
                  loading={isLoading}
                >
                  Settings
                </Button>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
      {isLoading && <FullScreenLoader />}
    </Page>
  );
}