import { json } from '@remix-run/node';
import { Form, useLoaderData, useActionData, useNavigation } from '@remix-run/react';
import { Card, FormLayout, TextField, Button, Toast, Text, Layout, Page, Spinner, Frame } from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';
import React, { useState, useEffect } from 'react';
import { authenticate } from '../shopify.server';
import prisma from '../db.server';
import NavigationBar from './NavigationBar';

// Define the full-screen loader component
const MiFullScreenLoader = () => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
    }}
  >
    <Spinner accessibilityLabel="Loading" size="large" />
  </div>
);

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const settings = await prisma.ageVerificationRules.findFirst({
      where: { shop },
    });

    const account = await prisma.account.findFirst({
      where: { shop },
      select: { serialkey: true },
    });

    return json({
      settings,
      shop,
      serialkey: account?.serialkey || null,
    });
  } catch (error) {
    return json({
      settings: null,
      shop: null,
      serialkey: null,
      error: 'Failed to load settings',
    }, { status: 500 });
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get('action');

  if (actionType === 'createAccount') {
    const username = formData.get('username');
    const email = formData.get('email');

    if (!username || !email) {
      return json(
        { success: false, error: 'Username and email are required' },
        { status: 400 }
      );
    }

    const serialkey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    try {
      const account = await prisma.account.create({
        data: { username, email, serialkey, shop },
      });
      return json(
        {
          success: true,
          message: 'Account created successfully',
          serialkey: account.serialkey,
        },
        { status: 200 }
      );
    } catch (error) {
      if (error.code === 'P2002') {
        return json(
          {
            success: false,
            error: 'Username, email, or serialkey already exists',
          },
          { status: 400 }
        );
      }
      return json(
        { success: false, error: 'Failed to create account' },
        { status: 500 }
      );
    }
  }

  let visibility = formData.get('visibility');
  let miPageUrls = [];

  const miPageUrlsInput = formData.get('pageUrls');
  if (miPageUrlsInput) {
    miPageUrls = miPageUrlsInput
      .split(/[,|\n]/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }
  if (visibility === 'specific' && miPageUrls.length === 0) {
    return json({ error: 'Please provide at least one URL for specific pages' }, { status: 400 });
  }
  if (!visibility) {
    visibility = 'all';
  }

  try {
    await prisma.ageVerificationRules.upsert({
      where: { shop },
      update: {
        visibility,
        pageUrls: miPageUrls,
      },
      create: {
        shop,
        visibility,
        pageUrls: miPageUrls,
      },
    });

    return json({ success: 'Rules saved successfully' }, { status: 200 });
  } catch (error) {
    return json({ error: 'Failed to save rules', details: error.message }, { status: 500 });
  }
};

const Rules = () => {
  const { settings, shop, serialkey, error } = useLoaderData();
  const miActionData = useActionData();
  const miNavigation = useNavigation();

  const [miShowToast, miSetShowToast] = useState(false);
  const [miToastMessage, miSetToastMessage] = useState('');
  const [miToastError, miSetToastError] = useState(false);
  const [miAccountForm, miSetAccountForm] = useState({ username: '', email: '' });
  const [miEmailError, miSetEmailError] = useState('');
  const [miFormData, miSetFormData] = useState({
    visibility: settings?.visibility || 'all',
    pageUrls: settings?.pageUrls?.join('\n') || '',
  });

  const miValidateEmail = (email) => {
    const miEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'Email is required';
    }
    if (!miEmailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const miHandleAccountChange = (field, value) => {
    miSetAccountForm(prev => ({
      ...prev,
      [field]: value,
    }));
    if (field === 'email') {
      miSetEmailError(miValidateEmail(value));
    }
  };

  const miHandleChange = (field, value) => {
    miSetFormData(prev => {
      if (field === 'visibility') {
        return {
          ...prev,
          visibility: value,
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  useEffect(() => {
    if (miActionData && miActionData.success && miNavigation.state === 'idle') {
      miSetToastMessage(miActionData.success || miActionData.message);
      miSetToastError(false);
      miSetShowToast(true);
      if (miActionData.serialkey) {
        miSetAccountForm({ username: '', email: '' });
        miSetEmailError('');
      }
    } else if (miActionData && miActionData.error && miNavigation.state === 'idle') {
      miSetToastMessage(miActionData.error);
      miSetToastError(true);
      miSetShowToast(true);
    }
  }, [miActionData, miNavigation.state]);

  const miToastMarkup = miShowToast ? (
    <Toast
      content={miToastMessage}
      error={miToastError}
      onDismiss={() => miSetShowToast(false)}
    />
  ) : null;

  const isNavigating = miNavigation.state !== 'idle';

  // Styles copied from AgeVerificationSettings.jsx
  const fieldContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    backgroundColor: 'rgb(246, 246, 247)',
    borderRadius: '5px',
    marginBottom: '10px'
  };

  const fieldLabelStyle = {
    fontSize: '14px',
    color: 'rgb(51, 51, 51)',
    margin: '0px'
  };

  if (error) {
    return (
      <Frame>
        <Page>
          <TitleBar title="Age Verification Rules" />
          <Layout>
            <Layout.Section>
              <NavigationBar />
              <Card>
                <Text variant="headingMd" as="h2" tone="critical">
                  Error Loading Rules
                </Text>
                <Text as="p" tone="critical">
                  {error}. Please try refreshing the page or contact support if the issue persists.
                </Text>
              </Card>
            </Layout.Section>
          </Layout>
          {isNavigating && <MiFullScreenLoader />}
        </Page>
      </Frame>
    );
  }

  if (!shop && !error) {
    return (
      <Frame>
        <Page>
          <TitleBar title="Age Verification Rules" />
          <Layout>
            <Layout.Section>
              <NavigationBar />
              <Card>
                <Text variant="headingMd" as="h2">
                  Loading Rules...
                </Text>
              </Card>
            </Layout.Section>
          </Layout>
          {isNavigating && <MiFullScreenLoader />}
        </Page>
      </Frame>
    );
  }

  return (
    <Frame>
      <Page>
        <TitleBar title="Age Verification Rules" />
        {miToastMarkup}
        <Layout>
          <Layout.Section>
            <NavigationBar />
            {!serialkey ? (
              <Card>
                <Text variant="headingMd" as="h2">
                  No Account Found
                </Text>
                <Text as="p" tone="subdued">
                  Please create an account to configure age verification rules for this shop.
                </Text>
                <Form method="post" style={{ marginTop: '20px' }}>
                  <input type="hidden" name="action" value="createAccount" />
                  <FormLayout>
                    <div style={fieldContainerStyle}>
                      <img src="/UsrAccount.svg" alt="Username Icon" style={{ width: '48px', height: '48px' }} />
                      <div style={{ flex: '1 1 0%' }}>
                        <p style={fieldLabelStyle}>Username</p>
                        <TextField
                          name="username"
                          value={miAccountForm.username}
                          onChange={(value) => miHandleAccountChange('username', value)}
                          autoComplete="off"
                          placeholder="Enter username"
                          required
                        />
                      </div>
                    </div>
                    <div style={fieldContainerStyle}>
                      <img src="/Mail.svg" alt="Email Icon" style={{ width: '48px', height: '48px' }} />
                      <div style={{ flex: '1 1 0%' }}>
                        <p style={fieldLabelStyle}>Email</p>
                        <TextField
                          type="email"
                          name="email"
                          value={miAccountForm.email}
                          onChange={(value) => miHandleAccountChange('email', value)}
                          autoComplete="email"
                          placeholder="Enter email"
                          required
                          error={miEmailError}
                        />
                      </div>
                    </div>
                    {miActionData?.error && !miActionData.serialkey && (
                      <Text as="p" tone="critical">
                        {miActionData.error}
                      </Text>
                    )}
                    <Button
                      primary
                      submit
                      disabled={
                        !miAccountForm.username ||
                        !miAccountForm.email ||
                        !!miEmailError ||
                        miNavigation.state === 'submitting'
                      }
                      loading={miNavigation.state === 'submitting'}
                    >
                      Create Account
                    </Button>
                  </FormLayout>
                </Form>
              </Card>
            ) : (
              <Card>
                <Text variant="headingMd" as="h2">
                  Popup Rules
                </Text>
                <Form method="post">
                  <FormLayout>
                    <input
                      type="hidden"
                      name="visibility"
                      value={miFormData.visibility}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={miFormData.visibility === 'all' ? '/enabled.svg' : '/disabled.svg'}
                          alt="All Pages Toggle"
                          style={{ cursor: 'pointer', width: '40px', height: '40px' }}
                          onClick={() => miHandleChange('visibility', 'all')}
                        />
                        <div>
                          <Text as="p">All Pages</Text>
                          <Text as="p" tone="subdued">
                            Enable to show age verification popup for all pages.
                          </Text>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={miFormData.visibility === 'specific' ? '/enabled.svg' : '/disabled.svg'}
                          alt="Specific Pages Toggle"
                          style={{ cursor: 'pointer', width: '40px', height: '40px' }}
                          onClick={() => miHandleChange('visibility', 'specific')}
                        />
                        <div>
                          <Text as="p">Specific Pages</Text>
                          <Text as="p" tone="subdued">
                            Enable to show age verification popup for specific pages.
                          </Text>
                        </div>
                      </div>
                    </div>
                    {miFormData.visibility === 'specific' && (
                      <TextField
                        label="Page URLs"
                        name="pageUrls"
                        value={miFormData.pageUrls}
                        onChange={(value) => miHandleChange('pageUrls', value)}
                        multiline={4}
                        helpText="Enter URLs one per line. You have to include full URLs (e.g., https://example.com/products)."
                        placeholder="https://example.com/products"
                      />
                    )}
                    <Button
                      primary
                      submit
                      loading={miNavigation.state === 'submitting'}
                      disabled={miNavigation.state === 'submitting'}
                    >
                      {miNavigation.state === 'submitting' ? 'Saving...' : 'Save Rules'}
                    </Button>
                  </FormLayout>
                </Form>
              </Card>
            )}
          </Layout.Section>
        </Layout>
        {isNavigating && <MiFullScreenLoader />}
      </Page>
    </Frame>
  );
};

export default Rules;