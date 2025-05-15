import { json } from '@remix-run/node';
import { Form, useLoaderData, useActionData, useNavigation } from '@remix-run/react';
import { Frame, Card, FormLayout, TextField, Button, Checkbox, Toast, Loading, Text, Layout, Page } from '@shopify/polaris';
import React, { useState, useEffect } from 'react';
import { authenticate } from '../shopify.server';
import prisma from '../db.server';

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
  let pageUrls = [];

  const pageUrlsInput = formData.get('pageUrls');
  if (pageUrlsInput) {
    pageUrls = pageUrlsInput
      .split(/[,|\n]/)
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }
  if (visibility === 'specific' && pageUrls.length === 0) {
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
        pageUrls,
      },
      create: {
        shop,
        visibility,
        pageUrls,
      },
    });

    return json({ success: 'Rules saved successfully' }, { status: 200 });
  } catch (error) {
    return json({ error: 'Failed to save rules', details: error.message }, { status: 500 });
  }
};

const Rules = () => {
  const { settings, shop, serialkey, error } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  const [accountForm, setAccountForm] = useState({ username: '', email: '' });
  const [emailError, setEmailError] = useState('');
  const [formData, setFormData] = useState({
    visibility: settings?.visibility || 'all',
    pageUrls: settings?.pageUrls?.join('\n') || '',
  });

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'Email is required';
    }
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const handleAccountChange = (field, value) => {
    setAccountForm(prev => ({
      ...prev,
      [field]: value,
    }));
    if (field === 'email') {
      setEmailError(validateEmail(value));
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
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
    if (actionData && actionData.success && navigation.state === 'idle') {
      setToastMessage(actionData.success || actionData.message);
      setToastError(false);
      setShowToast(true);
      if (actionData.serialkey) {
        setAccountForm({ username: '', email: '' });
        setEmailError('');
      }
    } else if (actionData && actionData.error && navigation.state === 'idle') {
      setToastMessage(actionData.error);
      setToastError(true);
      setShowToast(true);
    }
  }, [actionData, navigation.state]);

  const toastMarkup = showToast ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  if (error) {
    return (
      <Frame>
        <Page>
          <Layout>
            <Layout.Section>
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
        </Page>
      </Frame>
    );
  }

  if (!shop && !error) {
    return (
      <Frame>
        <Page>
          <Layout>
            <Layout.Section>
              <Card>
                <Text variant="headingMd" as="h2">
                  Loading Rules...
                </Text>
              </Card>
            </Layout.Section>
          </Layout>
        </Page>
      </Frame>
    );
  }

  return (
    <Frame>
      {navigation.state === 'submitting' && <Loading />}
      {toastMarkup}
      <Page>
        <Layout>
          <Layout.Section>
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
                    <TextField
                      label="Username"
                      name="username"
                      value={accountForm.username}
                      onChange={(value) => handleAccountChange('username', value)}
                      autoComplete="off"
                      placeholder="Enter username"
                      required
                    />
                    <TextField
                      label="Email"
                      type="email"
                      name="email"
                      value={accountForm.email}
                      onChange={(value) => handleAccountChange('email', value)}
                      autoComplete="email"
                      placeholder="Enter email"
                      required
                      error={emailError}
                    />
                    {actionData?.error && !actionData.serialkey && (
                      <Text as="p" tone="critical">
                        {actionData.error}
                      </Text>
                    )}
                    <Button
                      primary
                      submit
                      disabled={
                        !accountForm.username ||
                        !accountForm.email ||
                        !!emailError ||
                        navigation.state === 'submitting'
                      }
                      loading={navigation.state === 'submitting'}
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
                      value={formData.visibility}
                    />
                    <Checkbox
                      label="All Pages"
                      checked={formData.visibility === 'all'}
                      onChange={() => handleChange('visibility', 'all')}
                      helpText="Enable to show age verification popup for all pages."
                    />
                    <Checkbox
                      label="Specific Pages"
                      checked={formData.visibility === 'specific'}
                      onChange={() => handleChange('visibility', 'specific')}
                      helpText="Enable to show age verification popup for specific pages."
                    />
                    {formData.visibility === 'specific' && (
                      <TextField
                        label="Page URLs"
                        name="pageUrls"
                        value={formData.pageUrls}
                        onChange={(value) => handleChange('pageUrls', value)}
                        multiline={4}
                        helpText="Enter URLs one per line. You have to include full URLs (e.g., https://example.com/products)."
                        placeholder="https://example.com/products"
                      />
                    )}
                    <Button
                      primary
                      submit
                      loading={navigation.state === 'submitting'}
                      disabled={navigation.state === 'submitting'}
                    >
                      {navigation.state === 'submitting' ? 'Saving...' : 'Save Rules'}
                    </Button>
                  </FormLayout>
                </Form>
              </Card>
            )}
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
};

export default Rules;