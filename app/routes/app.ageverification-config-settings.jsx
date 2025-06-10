import { json } from '@remix-run/node';
import { Form, useLoaderData, useActionData, useNavigation } from '@remix-run/react';
import { Frame, Page, Layout, Card, FormLayout, TextField, Button, Select, Toast, Text, Collapsible, Spinner, InlineStack } from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';
import React, { useState, useEffect, useRef } from 'react';
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

// Custom File Input Component for Icon Image Upload
const CustomFileInput = ({ id, name, accept, fileInputRef, onChange }) => {
  const [fileName, setFileName] = useState('No file chosen');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setFileName(file ? file.name : 'No file chosen');
    if (onChange) onChange(event);
  };

  const handleClear = () => {
    setFileName('No file chosen');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <InlineStack gap="200" align="start" blockAlign="center">
      <div style={{ position: 'relative' }}>
        <input
          type="file"
          id={id}
          name={name}
          accept={accept}
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{
            opacity: 0,
            position: 'absolute',
            width: '100%',
            height: '100%',
            cursor: 'pointer',
          }}
        />
        <button
          type="button"
          style={{
            backgroundColor: '#DDD',
            border: '1px solid #D3D3D3',
            borderRadius: '15px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#000000',
          }}
        >
          Choose File
        </button>
      </div>
      <Text as="span" variant="bodyMd">
        {fileName}
      </Text>
      {fileName !== 'No file chosen' && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            backgroundColor: '#E0E0E0',
            border: '1px solid #D3D3D3',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#6D7175',
          }}
        >
          ✕
        </button>
      )}
    </InlineStack>
  );
};

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const settings = await prisma.ageVerificationSettings.findFirst({
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
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const formData = await request.formData();
    const actionType = formData.get("action");

    if (actionType === "createAccount") {
      const username = formData.get("username");
      const email = formData.get("email");

      if (!username || !email) {
        return json(
          { error: "Username and email are required", serialkey: null },
          { status: 400 }
        );
      }

      const miEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!miEmailRegex.test(email)) {
        return json(
          { error: "Please enter a valid email address", serialkey: null },
          { status: 400 }
        );
      }

      const existingAccount = await prisma.account.findFirst({
        where: { shop },
      });

      if (existingAccount) {
        return json(
          { success: "Account already exists", serialkey: existingAccount.serialkey },
          { status: 200 }
        );
      }

      const serialkey = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      await prisma.account.create({
        data: {
          username,
          email,
          serialkey,
          shop,
        },
      });

      return json({ success: "Account created successfully", serialkey }, { status: 200 });
    }

    const existingSettings = await prisma.ageVerificationSettings.findFirst({
      where: { shop },
    });

    const settingsData = {
      serialKey: formData.get("serialKey")?.trim() || existingSettings?.serialKey || "",
      status: formData.get("status")?.trim() || existingSettings?.status || "",
      ageLimit: parseInt(formData.get("ageLimit"), 10) || existingSettings?.ageLimit || 18,
      verificationType: formData.get("verificationType")?.trim() || existingSettings?.verificationType || "",
      linkTitle: formData.get("linkTitle")?.trim() || existingSettings?.linkTitle || "",
      anchorText: formData.get("anchorText")?.trim() || existingSettings?.anchorText || "",
      anchorUrl: formData.get("anchorUrl")?.trim() || existingSettings?.anchorUrl || "",
      textColor: formData.get("textColor")?.trim() || existingSettings?.textColor || "",
      buttonLabelLeft: formData.get("buttonLabelLeft")?.trim() || existingSettings?.buttonLabelLeft || "",
      buttonLeftBackgroundColor: formData.get("buttonLeftBackgroundColor")?.trim() || existingSettings?.buttonLeftBackgroundColor || "",
      buttonLeftTextColor: formData.get("buttonLeftTextColor")?.trim() || existingSettings?.buttonLeftTextColor || "",
      buttonLabelRight: formData.get("buttonLabelRight")?.trim() || existingSettings?.buttonLabelRight || "",
      buttonRightBackgroundColor: formData.get("buttonRightBackgroundColor")?.trim() || existingSettings?.buttonRightBackgroundColor || "",
      buttonRightTextColor: formData.get("buttonRightTextColor")?.trim() || existingSettings?.buttonRightTextColor || "",
      popupTitle: formData.get("popupTitle")?.trim() || existingSettings?.popupTitle || "",
      contentTitle: formData.get("contentTitle")?.trim() || existingSettings?.contentTitle || "",
      contentTitleColor: formData.get("contentTitleColor")?.trim() || existingSettings?.contentTitleColor || "",
      contentSubtitle: formData.get("contentSubtitle")?.trim() || existingSettings?.contentSubtitle || "",
      contentSubtitleColor: formData.get("contentSubtitleColor")?.trim() || existingSettings?.contentSubtitleColor || "",
      headerBackgroundColor: formData.get("headerBackgroundColor")?.trim() || existingSettings?.headerBackgroundColor || "",
      bodyBackgroundColor: formData.get("bodyBackgroundColor")?.trim() || existingSettings?.bodyBackgroundColor || "",
      underAgeNoticeType: formData.get("underAgeNoticeType")?.trim() || existingSettings?.underAgeNoticeType || "",
      underAgeMessage: formData.get("underAgeMessage")?.trim() || existingSettings?.underAgeMessage || "",
      redirectUrl: formData.get("redirectUrl")?.trim() || existingSettings?.redirectUrl || "",
      cookieLifetime: parseInt(formData.get("cookieLifetime"), 10) || existingSettings?.cookieLifetime || 30,
      shop,
    };

    console.log("Form Data Received:", settingsData);

    const miErrors = {};

    // Validate only if the fields are present in the form submission
    if (formData.has("buttonLabelLeft") && formData.has("buttonLabelRight")) {
      if (!settingsData.buttonLabelLeft) miErrors.buttonLabelLeft = 'Button Label Left is required';
      if (!settingsData.buttonLabelRight) miErrors.buttonLabelRight = 'Button Label Right is required';
    }

    if (formData.has("popupTitle") && formData.has("contentSubtitle")) {
      if (!settingsData.popupTitle) miErrors.popupTitle = 'Popup Title is required';
      if (!settingsData.contentSubtitle) miErrors.contentSubtitle = 'Content Subtitle is required';
    }

    if (settingsData.verificationType === 'checkbox') {
      const anchorFieldsPresent = formData.has("linkTitle") && formData.has("anchorText") && formData.has("anchorUrl");
      if (anchorFieldsPresent) {
        if (!settingsData.linkTitle) miErrors.linkTitle = 'Link Title is required';
        if (!settingsData.anchorText) miErrors.anchorText = 'Anchor Text is required';
        if (!settingsData.anchorUrl) miErrors.anchorUrl = 'Anchor URL is required';
      }
    }

    if (settingsData.underAgeNoticeType === 'show_message') {
      const underAgeMessagePresent = formData.has("underAgeMessage");
      if (underAgeMessagePresent && !settingsData.underAgeMessage) {
        miErrors.underAgeMessage = 'Under-Age Message is required';
      }
    }
    if (settingsData.underAgeNoticeType === 'redirect_url') {
      const redirectUrlPresent = formData.has("redirectUrl");
      if (redirectUrlPresent && !settingsData.redirectUrl) {
        miErrors.redirectUrl = 'Redirect URL is required';
      }
    }

    if (Object.keys(miErrors).length > 0) {
      console.log("Validation Errors:", miErrors);
      return json({ errors: miErrors }, { status: 400 });
    }

    let iconImage = null;
    const miIconImageFile = formData.get('iconImage');
    if (miIconImageFile && miIconImageFile instanceof File && miIconImageFile.size > 0) {
      try {
        const miArrayBuffer = await miIconImageFile.arrayBuffer();
        const miBuffer = Buffer.from(miArrayBuffer);
        iconImage = `data:${miIconImageFile.type};base64,${miBuffer.toString('base64')}`;
        settingsData.iconImage = iconImage;
      } catch (error) {
        return json({ error: 'Failed to process image' }, { status: 400 });
      }
    }

    if (existingSettings) {
      await prisma.ageVerificationSettings.update({
        where: { id: existingSettings.id },
        data: settingsData,
      });
    } else {
      await prisma.ageVerificationSettings.create({
        data: settingsData,
      });
    }

    return json({ success: "Settings saved successfully" }, { status: 200 });
  } catch (error) {
    return json({ error: "Failed to save settings: " + error.message }, { status: 500 });
  }
};

const AgeVerificationSettings = () => {
  const { settings, shop, serialkey, error } = useLoaderData();
  const miActionData = useActionData();
  const miNavigation = useNavigation();

  const [miShowToast, miSetShowToast] = useState(false);
  const [miToastMessage, miSetToastMessage] = useState('');
  const [miToastError, miSetToastError] = useState(false);
  const [miAccountForm, miSetAccountForm] = useState({ username: '', email: '' });
  const [miEmailError, miSetEmailError] = useState('');
  const [miFormErrors, miSetFormErrors] = useState({});

  const [miConfigurationOpen, miSetConfigurationOpen] = useState(true);
  const [miAnchorTextOpen, miSetAnchorTextOpen] = useState(false);
  const [miButtonSettingsOpen, miSetButtonSettingsOpen] = useState(false);
  const [miPopupSettingsOpen, miSetPopupSettingsOpen] = useState(false);
  const [miUnderAgeSettingsOpen, miSetUnderAgeSettingsOpen] = useState(false);
  const [miIconImageOpen, miSetIconImageOpen] = useState(false);

  const [miFormData, miSetFormData] = useState({
    serialKey: serialkey || settings?.serialKey || '',
    status: settings?.status || 'enable',
    ageLimit: settings?.ageLimit?.toString() || '18',
    verificationType: settings?.verificationType || 'checkbox',
    linkTitle: settings?.linkTitle || 'I agree with the',
    anchorText: settings?.anchorText || 'Terms and condition',
    anchorUrl: settings?.anchorUrl || 'https://www.milople.com/terms-of-use.html',
    textColor: settings?.textColor || '#ffffff',
    buttonLabelLeft: settings?.buttonLabelLeft || ' Agree',
    buttonLeftBackgroundColor: settings?.buttonLeftBackgroundColor || '#420642',
    buttonLeftTextColor: settings?.buttonLeftTextColor || '#ffffff',
    buttonLabelRight: settings?.buttonLabelRight || 'Disagree',
    buttonRightBackgroundColor: settings?.buttonRightBackgroundColor || '#420642',
    buttonRightTextColor: settings?.buttonRightTextColor || '#ffffff',
    popupTitle: settings?.popupTitle || 'AGE VERIFICATION',
    contentTitle: settings?.contentTitle || 'Are You 18 Year Or Older?',
    contentTitleColor: settings?.contentTitleColor || '#ffffff',
    contentSubtitle: settings?.contentSubtitle || 'We only provides service to adult of legal age',
    contentSubtitleColor: settings?.contentSubtitleColor || '#ffffff',
    headerBackgroundColor: settings?.headerBackgroundColor || '#eb2ceb',
    bodyBackgroundColor: settings?.bodyBackgroundColor || '#0a000a',
    underAgeNoticeType: settings?.underAgeNoticeType || 'show_message',
    underAgeMessage: settings?.underAgeMessage || 'You are too young to view this website.',
    redirectUrl: settings?.redirectUrl || 'https://www.google.com',
    cookieLifetime: settings?.cookieLifetime?.toString() || '30',
  });

  const miTextColorPickerRef = useRef(null);
  const miButtonLeftBackgroundColorPickerRef = useRef(null);
  const miButtonLeftTextColorPickerRef = useRef(null);
  const miButtonRightBackgroundColorPickerRef = useRef(null);
  const miButtonRightTextColorPickerRef = useRef(null);
  const miHeaderBackgroundColorPickerRef = useRef(null);
  const miBodyBackgroundColorPickerRef = useRef(null);
  const miContentTitleColorPickerRef = useRef(null);
  const miContentSubtitleColorPickerRef = useRef(null);
  const miIconImageInputRef = useRef(null);

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

  const miValidateForm = () => {
    const miErrors = {};

    // Validate Button Settings fields if section is open or fields have been modified
    if (miButtonSettingsOpen || miFormData.buttonLabelLeft !== settings?.buttonLabelLeft || miFormData.buttonLabelRight !== settings?.buttonLabelRight) {
      if (!miFormData.buttonLabelLeft?.trim()) miErrors.buttonLabelLeft = 'Button Label Left is required';
      if (!miFormData.buttonLabelRight?.trim()) miErrors.buttonLabelRight = 'Button Label Right is required';
    }

    // Validate Popup Settings fields if section is open or fields have been modified
    if (miPopupSettingsOpen || miFormData.popupTitle !== settings?.popupTitle || miFormData.contentSubtitle !== settings?.contentSubtitle) {
      if (!miFormData.popupTitle?.trim()) miErrors.popupTitle = 'Popup Title is required';
      if (!miFormData.contentSubtitle?.trim()) miErrors.contentSubtitle = 'Content Subtitle is required';
    }

    // Validate Anchor Text fields if verificationType is 'checkbox' and section is open or fields have been modified
    if (miFormData.verificationType === 'checkbox' && (miAnchorTextOpen || miFormData.linkTitle !== settings?.linkTitle || miFormData.anchorText !== settings?.anchorText || miFormData.anchorUrl !== settings?.anchorUrl)) {
      if (!miFormData.linkTitle?.trim()) miErrors.linkTitle = 'Link Title is required';
      if (!miFormData.anchorText?.trim()) miErrors.anchorText = 'Anchor Text is required';
      if (!miFormData.anchorUrl?.trim()) miErrors.anchorUrl = 'Anchor URL is required';
    }

    // Validate Under Age Notice fields if section is open or fields have been modified
    if (miUnderAgeSettingsOpen || miFormData.underAgeNoticeType !== settings?.underAgeNoticeType || miFormData.underAgeMessage !== settings?.underAgeMessage || miFormData.redirectUrl !== settings?.redirectUrl) {
      if (miFormData.underAgeNoticeType === 'show_message' && !miFormData.underAgeMessage?.trim()) {
        miErrors.underAgeMessage = 'Under-Age Message is required';
      }
      if (miFormData.underAgeNoticeType === 'redirect_url' && !miFormData.redirectUrl?.trim()) {
        miErrors.redirectUrl = 'Redirect URL is required';
      }
    }

    console.log("Client-Side Validation Errors:", miErrors);
    return miErrors;
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
    miSetFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    miSetFormErrors(prev => ({
      ...prev,
      [field]: '',
    }));
  };

  const miHandleColorChange = (event) => {
    const { name, value } = event.target;
    miSetFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    miSetFormErrors(prev => ({
      ...prev,
      [name]: '',
    }));
  };

  const miHandleFileChange = (event) => {
    // File name state is managed by CustomFileInput; this function is a placeholder for additional logic if needed
  };

  const miHandleSubmit = (event) => {
    console.log("Form Data on Submit:", miFormData);
    const miErrors = miValidateForm();
    if (Object.keys(miErrors).length > 0) {
      event.preventDefault();
      miSetFormErrors(miErrors);
      miSetToastMessage('Please fill in all required fields');
      miSetToastError(true);
      miSetShowToast(true);
    }
  };

  useEffect(() => {
    if (miActionData && miActionData.success && miNavigation.state === 'idle') {
      miSetToastMessage(miActionData.success);
      miSetToastError(false);
      miSetShowToast(true);
      miSetFormErrors({});
      if (miActionData.serialkey) {
        miSetFormData(prev => ({ ...prev, serialKey: miActionData.serialkey }));
        miSetAccountForm({ username: '', email: '' });
        miSetEmailError('');
      }
    } else if (miActionData && miActionData.errors && miNavigation.state === 'idle') {
      miSetFormErrors(miActionData.errors);
      miSetToastMessage('Please fill in all required fields');
      miSetToastError(true);
      miSetShowToast(true);
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

  const miShowAnchorFields = miFormData.verificationType === 'checkbox';
  const miShowUnderAgeMessage = miFormData.underAgeNoticeType === 'show_message';
  const miShowRedirectUrl = miFormData.underAgeNoticeType === 'redirect_url';
  const isNavigating = miNavigation.state !== 'idle';

  if (error) {
    return (
      <Frame>
        <Page>
          <TitleBar title="Age Verification Settings" />
          <Layout>
            <Layout.Section>
              <NavigationBar />
              <Card title="Error" sectioned>
                <Text variant="headingMd" as="h2" tone="critical">
                  Error Loading Settings
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
          <TitleBar title="Age Verification Settings" />
          <Layout>
            <Layout.Section>
              <NavigationBar />
              <Card title="Loading" sectioned>
                <Text variant="headingMd" as="h2">
                  Loading Settings...
                </Text>
              </Card>
            </Layout.Section>
          </Layout>
          {isNavigating && <MiFullScreenLoader />}
        </Page>
      </Frame>
    );
  }

  const fieldContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    backgroundColor: 'rgb(246, 246, 247)',
    borderRadius: '5px',
    marginBottom: '10px',
  };

  const fieldLabelStyle = {
    fontSize: '14px',
    color: 'rgb(51, 51, 51)',
    margin: '0px',
  };

  const fieldInputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid rgb(223, 227, 232)',
    borderRadius: '4px',
    fontSize: '14px',
    background: 'white',
  };

  const colorFieldContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px',
    backgroundColor: 'rgb(246, 246, 247)',
    borderRadius: '5px',
    marginBottom: '10px',
  };

  const colorFieldRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };

  const colorBarStyle = (color) => ({
    width: '40%',
    height: '40px',
    backgroundColor: color,
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid #767676',
  });

  const sectionHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px',
    cursor: 'pointer',
    backgroundColor: '#f4f6f8',
    borderRadius: '4px',
    marginBottom: '10px',
  };

  const iconStyle = {
    width: '20px',
    height: '20px',
  };

  const sectionWrapperStyle = {
    marginBottom: '20px',
  };

  const handleColorPickerClick = (ref) => {
    if (ref.current) {
      ref.current.click();
    }
  };

  return (
    <Frame>
      <Page>
        <TitleBar title="Age Verification Settings" />
        {miToastMarkup}
        <Layout>
          <Layout.Section>
            <NavigationBar />
            {!serialkey ? (
              <Card title="No Account Found" sectioned>
                <Text variant="headingMd" as="h2">
                  No Account Found
                </Text>
                <Text as="p" tone="subdued">
                  Please create an account to configure age verification settings for this shop.
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
                          error={miFormErrors.username}
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
                          error={miEmailError || miFormErrors.email}
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
              <Card title="Age Verification Settings" sectioned>
                <Form method="post" encType="multipart/form-data" onSubmit={miHandleSubmit}>
                  <FormLayout>
                    {/* Configuration Section */}
                    <div style={sectionWrapperStyle}>
                      <div style={sectionHeaderStyle} onClick={() => miSetConfigurationOpen(!miConfigurationOpen)}>
                        <Text variant="headingSm" as="h3">Configuration</Text>
                        <img
                          src={miConfigurationOpen ? '/Up.svg' : '/Down.svg'}
                          alt={miConfigurationOpen ? 'Collapse' : 'Expand'}
                          style={iconStyle}
                        />
                      </div>
                      <Collapsible open={miConfigurationOpen} id="configuration-collapsible">
                        <div style={fieldContainerStyle}>
                          <img src="/serial.svg" alt="Serial Key Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Serial Key</p>
                            <TextField
                              name="serialKey"
                              value={miFormData.serialKey}
                              onChange={(value) => miHandleChange('serialKey', value)}
                              autoComplete="off"
                              placeholder="Enter serial key"
                              error={miFormErrors.serialKey}
                              readOnly
                            />
                          </div>
                        </div>
                        <div style={fieldContainerStyle}>
                          <img src="/enable.svg" alt="Status Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Age Verification</p>
                            <Select
                              name="status"
                              options={[
                                { label: 'Enable', value: 'enable' },
                                { label: 'Disable', value: 'disable' },
                              ]}
                              value={miFormData.status}
                              onChange={(value) => miHandleChange('status', value)}
                              error={miFormErrors.status}
                            />
                          </div>
                        </div>
                        <div style={fieldContainerStyle}>
                          <img src="/agelimit.svg" alt="Age Limit Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Age Limit</p>
                            <TextField
                              type="number"
                              name="ageLimit"
                              value={miFormData.ageLimit}
                              onChange={(value) => miHandleChange('ageLimit', value)}
                              min="1"
                              error={miFormErrors.ageLimit}
                            />
                          </div>
                        </div>
                        <div style={fieldContainerStyle}>
                          <img src="/cookie.svg" alt="Cookie Lifetime Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Cookie Lifetime (in days)</p>
                            <TextField
                              type="number"
                              name="cookieLifetime"
                              value={miFormData.cookieLifetime}
                              onChange={(value) => miHandleChange('cookieLifetime', value)}
                              min="1"
                              placeholder="Enter number of days (e.g., 30)"
                              error={miFormErrors.cookieLifetime}
                            />
                          </div>
                        </div>
                        <div style={fieldContainerStyle}>
                          <img src="/verify.svg" alt="Verification Type Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Verification Type</p>
                            <Select
                              name="verificationType"
                              options={[
                                { label: 'Checkbox', value: 'checkbox' },
                                { label: 'Yes/No', value: 'yesno' },
                                { label: 'Date Of Birth', value: 'dateofbirth' },
                              ]}
                              value={miFormData.verificationType}
                              onChange={(value) => miHandleChange('verificationType', value)}
                              error={miFormErrors.verificationType}
                            />
                          </div>
                        </div>
                      </Collapsible>
                    </div>

                    {/* Anchor Text Section */}
                    {miShowAnchorFields && (
                      <div style={sectionWrapperStyle}>
                        <div style={sectionHeaderStyle} onClick={() => miSetAnchorTextOpen(!miAnchorTextOpen)}>
                          <Text variant="headingSm" as="h3">Anchor Text</Text>
                          <img
                            src={miAnchorTextOpen ? '/Up.svg' : '/Down.svg'}
                            alt={miAnchorTextOpen ? 'Collapse' : 'Expand'}
                            style={iconStyle}
                          />
                        </div>
                        <Collapsible open={miAnchorTextOpen} id="anchor-text-collapsible">
                          <div style={fieldContainerStyle}>
                            <img src="/linktext.svg" alt="Link Title Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: '1 1 0%' }}>
                              <p style={fieldLabelStyle}>Link Title</p>
                              <TextField
                                name="linkTitle"
                                value={miFormData.linkTitle}
                                onChange={(value) => miHandleChange('linkTitle', value)}
                                required={miAnchorTextOpen}
                                error={miFormErrors.linkTitle}
                              />
                            </div>
                          </div>
                          <div style={fieldContainerStyle}>
                            <img src="/linktext.svg" alt="Anchor Text Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: '1 1 0%' }}>
                              <p style={fieldLabelStyle}>Anchor Text</p>
                              <TextField
                                name="anchorText"
                                value={miFormData.anchorText}
                                onChange={(value) => miHandleChange('anchorText', value)}
                                required={miAnchorTextOpen}
                                error={miFormErrors.anchorText}
                              />
                            </div>
                          </div>
                          <div style={fieldContainerStyle}>
                            <img src="/url.svg" alt="Anchor URL Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: '1 1 0%' }}>
                              <p style={fieldLabelStyle}>Anchor URL</p>
                              <TextField
                                name="anchorUrl"
                                value={miFormData.anchorUrl}
                                onChange={(value) => miHandleChange('anchorUrl', value)}
                                required={miAnchorTextOpen}
                                error={miFormErrors.anchorUrl}
                              />
                            </div>
                          </div>
                          <div style={colorFieldContainerStyle}>
                            <p style={fieldLabelStyle}>Anchor Text Color</p>
                            <div style={colorFieldRowStyle}>
                              <img src="/textcolor.svg" alt="Anchor Text Color Icon" style={{ width: '48px', height: '48px' }} />
                              <div style={{ flex: 1, position: 'relative' }}>
                                <div
                                  style={colorBarStyle(miFormData.textColor)}
                                  onClick={() => handleColorPickerClick(miTextColorPickerRef)}
                                />
                                <input
                                  type="color"
                                  ref={miTextColorPickerRef}
                                  name="textColor"
                                  value={miFormData.textColor}
                                  onChange={miHandleColorChange}
                                  style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                                />
                              </div>
                            </div>
                            {miFormErrors.textColor && (
                              <Text as="p" tone="critical">
                                {miFormErrors.textColor}
                              </Text>
                            )}
                          </div>
                        </Collapsible>
                      </div>
                    )}

                    {/* Button Settings Section */}
                    <div style={sectionWrapperStyle}>
                      <div style={sectionHeaderStyle} onClick={() => miSetButtonSettingsOpen(!miButtonSettingsOpen)}>
                        <Text variant="headingSm" as="h3">Button Settings</Text>
                        <img
                          src={miButtonSettingsOpen ? '/Up.svg' : '/Down.svg'}
                          alt={miButtonSettingsOpen ? 'Collapse' : 'Expand'}
                          style={iconStyle}
                        />
                      </div>
                      <Collapsible open={miButtonSettingsOpen} id="button-settings-collapsible">
                        <div style={fieldContainerStyle}>
                          <img src="/left.svg" alt="Button Label Left Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Button Label Left</p>
                            <TextField
                              name="buttonLabelLeft"
                              value={miFormData.buttonLabelLeft}
                              onChange={(value) => miHandleChange('buttonLabelLeft', value)}
                              required={miButtonSettingsOpen}
                              error={miFormErrors.buttonLabelLeft}
                            />
                          </div>
                        </div>
                        <div style={colorFieldContainerStyle}>
                          <p style={fieldLabelStyle}>Button Left Background Color</p>
                          <div style={colorFieldRowStyle}>
                            <img src="/textcolor.svg" alt="Button Left Background Color Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: 1, position: 'relative' }}>
                              <div
                                style={colorBarStyle(miFormData.buttonLeftBackgroundColor)}
                                onClick={() => handleColorPickerClick(miButtonLeftBackgroundColorPickerRef)}
                              />
                              <input
                                type="color"
                                ref={miButtonLeftBackgroundColorPickerRef}
                                name="buttonLeftBackgroundColor"
                                value={miFormData.buttonLeftBackgroundColor}
                                onChange={miHandleColorChange}
                                style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                              />
                            </div>
                          </div>
                          {miFormErrors.buttonLeftBackgroundColor && (
                            <Text as="p" tone="critical">
                              {miFormErrors.buttonLeftBackgroundColor}
                            </Text>
                          )}
                        </div>
                        <div style={colorFieldContainerStyle}>
                          <p style={fieldLabelStyle}>Button Left Text Color</p>
                          <div style={colorFieldRowStyle}>
                            <img src="/textcolor.svg" alt="Button Left Text Color Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: 1, position: 'relative' }}>
                              <div
                                style={colorBarStyle(miFormData.buttonLeftTextColor)}
                                onClick={() => handleColorPickerClick(miButtonLeftTextColorPickerRef)}
                              />
                              <input
                                type="color"
                                ref={miButtonLeftTextColorPickerRef}
                                name="buttonLeftTextColor"
                                value={miFormData.buttonLeftTextColor}
                                onChange={miHandleColorChange}
                                style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                              />
                            </div>
                          </div>
                          {miFormErrors.buttonLeftTextColor && (
                            <Text as="p" tone="critical">
                              {miFormErrors.buttonLeftTextColor}
                            </Text>
                          )}
                        </div>
                        <div style={fieldContainerStyle}>
                          <img src="/right.svg" alt="Button Label Right Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Button Label Right</p>
                            <TextField
                              name="buttonLabelRight"
                              value={miFormData.buttonLabelRight}
                              onChange={(value) => miHandleChange('buttonLabelRight', value)}
                              required={miButtonSettingsOpen}
                              error={miFormErrors.buttonLabelRight}
                            />
                          </div>
                        </div>
                        <div style={colorFieldContainerStyle}>
                          <p style={fieldLabelStyle}>Button Right Background Color</p>
                          <div style={colorFieldRowStyle}>
                            <img src="/textcolor.svg" alt="Button Right Background Color Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: 1, position: 'relative' }}>
                              <div
                                style={colorBarStyle(miFormData.buttonRightBackgroundColor)}
                                onClick={() => handleColorPickerClick(miButtonRightBackgroundColorPickerRef)}
                              />
                              <input
                                type="color"
                                ref={miButtonRightBackgroundColorPickerRef}
                                name="buttonRightBackgroundColor"
                                value={miFormData.buttonRightBackgroundColor}
                                onChange={miHandleColorChange}
                                style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                              />
                            </div>
                          </div>
                          {miFormErrors.buttonRightBackgroundColor && (
                            <Text as="p" tone="critical">
                              {miFormErrors.buttonRightBackgroundColor}
                            </Text>
                          )}
                        </div>
                        <div style={colorFieldContainerStyle}>
                          <p style={fieldLabelStyle}>Button Right Text Color</p>
                          <div style={colorFieldRowStyle}>
                            <img src="/textcolor.svg" alt="Button Right Text Color Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: 1, position: 'relative' }}>
                              <div
                                style={colorBarStyle(miFormData.buttonRightTextColor)}
                                onClick={() => handleColorPickerClick(miButtonRightTextColorPickerRef)}
                              />
                              <input
                                type="color"
                                ref={miButtonRightTextColorPickerRef}
                                name="buttonRightTextColor"
                                value={miFormData.buttonRightTextColor}
                                onChange={miHandleColorChange}
                                style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                              />
                            </div>
                          </div>
                          {miFormErrors.buttonRightTextColor && (
                            <Text as="p" tone="critical">
                              {miFormErrors.buttonRightTextColor}
                            </Text>
                          )}
                        </div>
                      </Collapsible>
                    </div>

                    {/* Popup Settings Section */}
                    <div style={sectionWrapperStyle}>
                      <div style={sectionHeaderStyle} onClick={() => miSetPopupSettingsOpen(!miPopupSettingsOpen)}>
                        <Text variant="headingSm" as="h3">Popup Settings</Text>
                        <img
                          src={miPopupSettingsOpen ? '/Up.svg' : '/Down.svg'}
                          alt={miPopupSettingsOpen ? 'Collapse' : 'Expand'}
                          style={iconStyle}
                        />
                      </div>
                      <Collapsible open={miPopupSettingsOpen} id="popup-settings-collapsible">
                        <div style={fieldContainerStyle}>
                          <img src="/linktext.svg" alt="Popup Title Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Popup Title</p>
                            <TextField
                              name="popupTitle"
                              value={miFormData.popupTitle}
                              onChange={(value) => miHandleChange('popupTitle', value)}
                              required={miPopupSettingsOpen}
                              error={miFormErrors.popupTitle}
                            />
                          </div>
                        </div>
                        <div style={colorFieldContainerStyle}>
                          <p style={fieldLabelStyle}>Header Background Color</p>
                          <div style={colorFieldRowStyle}>
                            <img src="/textcolor.svg" alt="Header Background Color Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: 1, position: 'relative' }}>
                              <div
                                style={colorBarStyle(miFormData.headerBackgroundColor)}
                                onClick={() => handleColorPickerClick(miHeaderBackgroundColorPickerRef)}
                              />
                              <input
                                type="color"
                                ref={miHeaderBackgroundColorPickerRef}
                                name="headerBackgroundColor"
                                value={miFormData.headerBackgroundColor}
                                onChange={miHandleColorChange}
                                style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                              />
                            </div>
                          </div>
                          {miFormErrors.headerBackgroundColor && (
                            <Text as="p" tone="critical">
                              {miFormErrors.headerBackgroundColor}
                            </Text>
                          )}
                        </div>
                        <div style={colorFieldContainerStyle}>
                          <p style={fieldLabelStyle}>Body Background Color</p>
                          <div style={colorFieldRowStyle}>
                            <img src="/textcolor.svg" alt="Body Background Color Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: 1, position: 'relative' }}>
                              <div
                                style={colorBarStyle(miFormData.bodyBackgroundColor)}
                                onClick={() => handleColorPickerClick(miBodyBackgroundColorPickerRef)}
                              />
                              <input
                                type="color"
                                ref={miBodyBackgroundColorPickerRef}
                                name="bodyBackgroundColor"
                                value={miFormData.bodyBackgroundColor}
                                onChange={miHandleColorChange}
                                style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                              />
                            </div>
                          </div>
                          {miFormErrors.bodyBackgroundColor && (
                            <Text as="p" tone="critical">
                              {miFormErrors.bodyBackgroundColor}
                            </Text>
                          )}
                        </div>
                        <div style={fieldContainerStyle}>
                          <img src="/linktext.svg" alt="Content Title Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Content Title</p>
                            <TextField
                              name="contentTitle"
                              value={miFormData.contentTitle}
                              onChange={(value) => miHandleChange('contentTitle', value)}
                              error={miFormErrors.contentTitle}
                            />
                          </div>
                        </div>
                        <div style={colorFieldContainerStyle}>
                          <p style={fieldLabelStyle}>Content Title Color</p>
                          <div style={colorFieldRowStyle}>
                            <img src="/textcolor.svg" alt="Content Title Color Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: 1, position: 'relative' }}>
                              <div
                                style={colorBarStyle(miFormData.contentTitleColor)}
                                onClick={() => handleColorPickerClick(miContentTitleColorPickerRef)}
                              />
                              <input
                                type="color"
                                ref={miContentTitleColorPickerRef}
                                name="contentTitleColor"
                                value={miFormData.contentTitleColor}
                                onChange={miHandleColorChange}
                                style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                              />
                            </div>
                          </div>
                          {miFormErrors.contentTitleColor && (
                            <Text as="p" tone="critical">
                              {miFormErrors.contentTitleColor}
                            </Text>
                          )}
                        </div>
                        <div style={fieldContainerStyle}>
                          <img src="/linktext.svg" alt="Content Subtitle Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Content Subtitle</p>
                            <TextField
                              name="contentSubtitle"
                              value={miFormData.contentSubtitle}
                              onChange={(value) => miHandleChange('contentSubtitle', value)}
                              multiline={4}
                              required={miPopupSettingsOpen}
                              error={miFormErrors.contentSubtitle}
                            />
                          </div>
                        </div>
                        <div style={colorFieldContainerStyle}>
                          <p style={fieldLabelStyle}>Content Subtitle Color</p>
                          <div style={colorFieldRowStyle}>
                            <img src="/textcolor.svg" alt="Content Subtitle Color Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: 1, position: 'relative' }}>
                              <div
                                style={colorBarStyle(miFormData.contentSubtitleColor)}
                                onClick={() => handleColorPickerClick(miContentSubtitleColorPickerRef)}
                              />
                              <input
                                type="color"
                                ref={miContentSubtitleColorPickerRef}
                                name="contentSubtitleColor"
                                value={miFormData.contentSubtitleColor}
                                onChange={miHandleColorChange}
                                style={{ opacity: 0, position: 'absolute', width: '0', height: '0' }}
                              />
                            </div>
                          </div>
                          {miFormErrors.contentSubtitleColor && (
                            <Text as="p" tone="critical">
                              {miFormErrors.contentSubtitleColor}
                            </Text>
                          )}
                        </div>
                      </Collapsible>
                    </div>

                    {/* Under Age Notice Settings Section */}
                    <div style={sectionWrapperStyle}>
                      <div style={sectionHeaderStyle} onClick={() => miSetUnderAgeSettingsOpen(!miUnderAgeSettingsOpen)}>
                        <Text variant="headingSm" as="h3">Under Age Notice Settings</Text>
                        <img
                          src={miUnderAgeSettingsOpen ? '/Up.svg' : '/Down.svg'}
                          alt={miUnderAgeSettingsOpen ? 'Collapse' : 'Expand'}
                          style={iconStyle}
                        />
                      </div>
                      <Collapsible open={miUnderAgeSettingsOpen} id="under-age-settings-collapsible">
                        <div style={fieldContainerStyle}>
                          <img src="/notice.svg" alt="Under-Age Notice Type Icon" style={{ width: '48px', height: '48px' }} />
                          <div style={{ flex: '1 1 0%' }}>
                            <p style={fieldLabelStyle}>Under-Age Notice Type</p>
                            <Select
                              name="underAgeNoticeType"
                              options={[
                                { label: 'Show Message', value: 'show_message' },
                                { label: 'Redirect URL', value: 'redirect_url' },
                              ]}
                              value={miFormData.underAgeNoticeType}
                              onChange={(value) => miHandleChange('underAgeNoticeType', value)}
                              error={miFormErrors.underAgeNoticeType}
                            />
                          </div>
                        </div>
                        {miShowUnderAgeMessage && (
                          <div style={fieldContainerStyle}>
                            <img src="/linktext.svg" alt="Under-Age Message Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: '1 1 0%' }}>
                              <p style={fieldLabelStyle}>Under-Age Message</p>
                              <TextField
                                name="underAgeMessage"
                                value={miFormData.underAgeMessage}
                                onChange={(value) => miHandleChange('underAgeMessage', value)}
                                multiline={4}
                                placeholder="Enter message for under-age users"
                                required={miUnderAgeSettingsOpen}
                                error={miFormErrors.underAgeMessage}
                              />
                            </div>
                          </div>
                        )}
                        {miShowRedirectUrl && (
                          <div style={fieldContainerStyle}>
                            <img src="/linktext.svg" alt="Redirect URL Icon" style={{ width: '48px', height: '48px' }} />
                            <div style={{ flex: '1 1 0%' }}>
                              <p style={fieldLabelStyle}>Redirect URL</p>
                              <TextField
                                name="redirectUrl"
                                value={miFormData.redirectUrl}
                                onChange={(value) => miHandleChange('redirectUrl', value)}
                                placeholder="Enter redirect URL for under-age users"
                                required={miUnderAgeSettingsOpen}
                                error={miFormErrors.redirectUrl}
                              />
                            </div>
                          </div>
                        )}
                      </Collapsible>
                    </div>

                    {/* Icon Image Section */}
                    <div style={sectionWrapperStyle}>
                      <div style={sectionHeaderStyle} onClick={() => miSetIconImageOpen(!miIconImageOpen)}>
                        <Text variant="headingSm" as="h3">Icon Image</Text>
                        <img
                          src={miIconImageOpen ? '/Up.svg' : '/Down.svg'}
                          alt={miIconImageOpen ? 'Collapse' : 'Expand'}
                          style={iconStyle}
                        />
                      </div>
                      <Collapsible open={miIconImageOpen} id="icon-image-collapsible">
                        <div style={{ padding: '10px' }}>
                          <p style={fieldLabelStyle}>Icon Image</p>
                          <CustomFileInput
                            id="iconImage"
                            name="iconImage"
                            accept="image/jpeg,image/png,image/gif"
                            fileInputRef={miIconImageInputRef}
                            onChange={miHandleFileChange}
                          />
                          <div style={{ marginTop: '4px', color: '#6d7175', fontSize: '12px' }}>
                            Choose the icon to upload (JPEG, GIF, PNG).
                          </div>
                          {settings && settings.iconImage && (
                            <div style={{ marginTop: '8px' }}>
                              <img
                                src={settings.iconImage}
                                alt="Icon Preview"
                                style={{ maxWidth: '200px' }}
                              />
                            </div>
                          )}
                        </div>
                      </Collapsible>
                    </div>

                    <Button
                      primary
                      submit
                      loading={miNavigation.state === 'submitting'}
                      disabled={miNavigation.state === 'submitting'}
                    >
                      {miNavigation.state === "submitting" ? "Saving..." : "Save Settings"}
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

export default AgeVerificationSettings;
