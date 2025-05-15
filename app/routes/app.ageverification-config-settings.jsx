import { json } from '@remix-run/node';
import { Form, useLoaderData, useActionData, useNavigation } from '@remix-run/react';
import { Frame, Page, Layout, Card, FormLayout, TextField, Button, Select, Toast, Text } from '@shopify/polaris';
import React, { useState, useEffect, useRef } from 'react';
import { authenticate } from '../shopify.server';
import prisma from '../db.server';
import { TitleBar } from '@shopify/app-bridge-react';

const colorFieldStyles = (color) => ({
  backgroundColor: color,
  borderRadius: '4px',
  overflow: 'hidden',
  padding: '4px',
});

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

    // Handle account creation
    if (actionType === "createAccount") {
      const username = formData.get("username");
      const email = formData.get("email");

      if (!username || !email) {
        return json(
          { error: "Username and email are required", serialkey: null },
          { status: 400 }
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
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

    // Handle settings update
    const settingsData = {
      serialKey: formData.get("serialKey"),
      status: formData.get("status"),
      ageLimit: parseInt(formData.get("ageLimit"), 10),
      verificationType: formData.get("verificationType"),
      linkTitle: formData.get("linkTitle"),
      anchorText: formData.get("anchorText"),
      anchorUrl: formData.get("anchorUrl"),
      textColor: formData.get("textColor"),
      buttonLabelLeft: formData.get("buttonLabelLeft"),
      buttonLeftBackgroundColor: formData.get("buttonLeftBackgroundColor"),
      buttonLeftTextColor: formData.get("buttonLeftTextColor"),
      buttonLabelRight: formData.get("buttonLabelRight"),
      buttonRightBackgroundColor: formData.get("buttonRightBackgroundColor"),
      buttonRightTextColor: formData.get("buttonRightTextColor"),
      popupTitle: formData.get("popupTitle"),
      contentTitle: formData.get("contentTitle"),
      contentTitleColor: formData.get("contentTitleColor"),
      contentSubtitle: formData.get("contentSubtitle"),
      contentSubtitleColor: formData.get("contentSubtitleColor"),
      headerBackgroundColor: formData.get("headerBackgroundColor"),
      bodyBackgroundColor: formData.get("bodyBackgroundColor"),
      underAgeNoticeType: formData.get("underAgeNoticeType"),
      underAgeMessage: formData.get("underAgeMessage"),
      redirectUrl: formData.get("redirectUrl"),
      cookieLifetime: parseInt(formData.get("cookieLifetime"), 10),
      shop,
    };

    // Validation
    const errors = {};
    if (!settingsData.buttonLabelLeft) errors.buttonLabelLeft = 'Button Label Left is required';
    if (!settingsData.buttonLabelRight) errors.buttonLabelRight = 'Button Label Right is required';
    if (!settingsData.popupTitle) errors.popupTitle = 'Popup Title is required';
    if (!settingsData.contentSubtitle) errors.contentSubtitle = 'Content Subtitle is required';

    if (settingsData.verificationType === 'checkbox') {
      if (!settingsData.linkTitle) errors.linkTitle = 'Link Title is required';
      if (!settingsData.anchorText) errors.anchorText = 'Anchor Text is required';
      if (!settingsData.anchorUrl) errors.anchorUrl = 'Anchor URL is required';
    }

    if (settingsData.underAgeNoticeType === 'show_message' && !settingsData.underAgeMessage) {
      errors.underAgeMessage = 'Under-Age Message is required';
    }
    if (settingsData.underAgeNoticeType === 'redirect_url' && !settingsData.redirectUrl) {
      errors.redirectUrl = 'Redirect URL is required';
    }

    if (Object.keys(errors).length > 0) {
      return json({ errors }, { status: 400 });
    }

    // Handle iconImage file upload
    let iconImage = null;
    const iconImageFile = formData.get('iconImage');
    if (iconImageFile && iconImageFile instanceof File && iconImageFile.size > 0) {
      try {
        const arrayBuffer = await iconImageFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        iconImage = `data:${iconImageFile.type};base64,${buffer.toString('base64')}`;
        settingsData.iconImage = iconImage;
      } catch (error) {
        return json({ error: 'Failed to process image' }, { status: 400 });
      }
    }

    // Check if settings exist, then either update or create
    const existingSettings = await prisma.ageVerificationSettings.findFirst({
      where: { shop },
    });

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
  const actionData = useActionData();
  const navigation = useNavigation();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  const [fileName, setFileName] = useState('No file chosen');
  const [accountForm, setAccountForm] = useState({ username: '', email: '' });
  const [emailError, setEmailError] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
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

  const textColorPickerRef = useRef(null);
  const buttonLeftBackgroundColorPickerRef = useRef(null);
  const buttonLeftTextColorPickerRef = useRef(null);
  const buttonRightBackgroundColorPickerRef = useRef(null);
  const buttonRightTextColorPickerRef = useRef(null);
  const headerBackgroundColorPickerRef = useRef(null);
  const bodyBackgroundColorPickerRef = useRef(null);
  const contentTitleColorPickerRef = useRef(null);
  const contentSubtitleColorPickerRef = useRef(null);

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

  const validateForm = () => {
    const errors = {};

    // Always required fields
    if (!formData.buttonLabelLeft) errors.buttonLabelLeft = 'Button Label Left is required';
    if (!formData.buttonLabelRight) errors.buttonLabelRight = 'Button Label Right is required';
    if (!formData.popupTitle) errors.popupTitle = 'Popup Title is required';
    if (!formData.contentSubtitle) errors.contentSubtitle = 'Content Subtitle is required';

    // Conditionally required fields for verificationType === 'checkbox'
    if (formData.verificationType === 'checkbox') {
      if (!formData.linkTitle) errors.linkTitle = 'Link Title is required';
      if (!formData.anchorText) errors.anchorText = 'Anchor Text is required';
      if (!formData.anchorUrl) errors.anchorUrl = 'Anchor URL is required';
    }

    // Conditionally required fields for underAgeNoticeType
    if (formData.underAgeNoticeType === 'show_message' && !formData.underAgeMessage) {
      errors.underAgeMessage = 'Under-Age Message is required';
    }
    if (formData.underAgeNoticeType === 'redirect_url' && !formData.redirectUrl) {
      errors.redirectUrl = 'Redirect URL is required';
    }

    return errors;
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
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for the field when user starts typing
    setFormErrors(prev => ({
      ...prev,
      [field]: '',
    }));
  };

  const handleColorChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value, // Fixed: Changed 'field' to 'name'
    }));
    setFormErrors(prev => ({
      ...prev,
      [name]: '',
    }));
  };

  useEffect(() => {
    if (actionData && actionData.success && navigation.state === 'idle') {
      setToastMessage(actionData.success);
      setToastError(false);
      setShowToast(true);
      setFormErrors({});
      if (actionData.serialkey) {
        setFormData(prev => ({ ...prev, serialKey: actionData.serialkey }));
        setAccountForm({ username: '', email: '' });
        setEmailError('');
      }
    } else if (actionData && actionData.errors && navigation.state === 'idle') {
      setFormErrors(actionData.errors);
      setToastMessage('Please fill in all required fields');
      setToastError(true);
      setShowToast(true);
    } else if (actionData && actionData.error && navigation.state === 'idle') {
      setToastMessage(actionData.error);
      setToastError(true);
      setShowToast(true);
    }
  }, [actionData, navigation.state]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setFileName(file ? file.name : 'No file chosen');
  };

  const openColorPicker = (colorPickerRef) => {
    if (colorPickerRef.current) {
      colorPickerRef.current.click();
    }
  };

  const handleSubmit = (event) => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      event.preventDefault();
      setFormErrors(errors);
      setToastMessage('Please fill in all required fields');
      setToastError(true);
      setShowToast(true);
    }
  };

  const toastMarkup = showToast ? (
    <Toast
      content={toastMessage}
      error={toastError}
      onDismiss={() => setShowToast(false)}
    />
  ) : null;

  const showAnchorFields = formData.verificationType === 'checkbox';
  const showUnderAgeMessage = formData.underAgeNoticeType === 'show_message';
  const showRedirectUrl = formData.underAgeNoticeType === 'redirect_url';

  if (error) {
    return (
      <Frame>
        <Page>
          <TitleBar title="Age Verification Settings" />
          <Layout>
            <Layout.Section>
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
              <Card title="Loading" sectioned>
                <Text variant="headingMd" as="h2">
                  Loading Settings...
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
      <Page>
        <TitleBar title="Age Verification Settings" />
        {toastMarkup}
        <Layout>
          <Layout.Section>
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
                    <TextField
                      label="Username"
                      name="username"
                      value={accountForm.username}
                      onChange={(value) => handleAccountChange('username', value)}
                      autoComplete="off"
                      placeholder="Enter username"
                      required
                      error={formErrors.username}
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
                      error={emailError || formErrors.email}
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
              <Card title="Age Verification Settings" sectioned>
                <Form method="post" encType="multipart/form-data" onSubmit={handleSubmit}>
                  <FormLayout>
                    <div>
                      <TextField
                        label="Serial Key"
                        name="serialKey"
                        value={formData.serialKey}
                        onChange={(value) => handleChange('serialKey', value)}
                        autoComplete="off"
                        placeholder="Enter serial key"
                        error={formErrors.serialKey}
                        readOnly
                      />
                    </div>
                    <Select
                      label="Age Verification"
                      name="status"
                      options={[
                        { label: 'Enable', value: 'enable' },
                        { label: 'Disable', value: 'disable' },
                      ]}
                      value={formData.status}
                      onChange={(value) => handleChange('status', value)}
                      error={formErrors.status}
                    />
                    <TextField
                      label="Age Limit"
                      type="number"
                      name="ageLimit"
                      value={formData.ageLimit}
                      onChange={(value) => handleChange('ageLimit', value)}
                      min="1"
                      error={formErrors.ageLimit}
                    />
                    <TextField
                      label="Cookie Lifetime (in days)"
                      type="number"
                      name="cookieLifetime"
                      value={formData.cookieLifetime}
                      onChange={(value) => handleChange('cookieLifetime', value)}
                      min="1"
                      placeholder="Enter number of days (e.g., 30)"
                      error={formErrors.cookieLifetime}
                    />
                    <Select
                      label="Verification Type"
                      name="verificationType"
                      options={[
                        { label: 'Checkbox', value: 'checkbox' },
                        { label: 'Yes/No', value: 'yesno' },
                        { label: 'Date Of Birth', value: 'dateofbirth' },
                      ]}
                      value={formData.verificationType}
                      onChange={(value) => handleChange('verificationType', value)}
                      error={formErrors.verificationType}
                    />
                    {showAnchorFields && (
                      <>
                        <div style={{ marginBottom: '1rem' }}>
                          <TextField
                            label="Link Title"
                            name="linkTitle"
                            value={formData.linkTitle}
                            onChange={(value) => handleChange('linkTitle', value)}
                            required
                            error={formErrors.linkTitle}
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <TextField
                            label="Anchor Text"
                            name="anchorText"
                            value={formData.anchorText}
                            onChange={(value) => handleChange('anchorText', value)}
                            required
                            error={formErrors.anchorText}
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <TextField
                            label="Anchor URL"
                            name="anchorUrl"
                            value={formData.anchorUrl}
                            onChange={(value) => handleChange('anchorUrl', value)}
                            required
                            error={formErrors.anchorUrl}
                          />
                        </div>
                        <div style={{ ...colorFieldStyles(formData.textColor), marginBottom: '1rem' }}>
                          <TextField
                            label="Anchor Text Color"
                            name="textColor"
                            value={formData.textColor}
                            onChange={(value) => handleChange('textColor', value)}
                            connectedRight={
                              <input
                                type="color"
                                ref={textColorPickerRef}
                                name="textColor"
                                value={formData.textColor}
                                onChange={handleColorChange}
                                style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                              />
                            }
                            error={formErrors.textColor}
                          />
                        </div>
                      </>
                    )}
                    <TextField
                      label="Button Label Left"
                      name="buttonLabelLeft"
                      value={formData.buttonLabelLeft}
                      onChange={(value) => handleChange('buttonLabelLeft', value)}
                      required
                      error={formErrors.buttonLabelLeft}
                    />
                    <div style={colorFieldStyles(formData.buttonLeftBackgroundColor)}>
                      <TextField
                        label="Button Left Background Color"
                        name="buttonLeftBackgroundColor"
                        value={formData.buttonLeftBackgroundColor}
                        onChange={(value) => handleChange('buttonLeftBackgroundColor', value)}
                        connectedRight={
                          <input
                            type="color"
                            ref={buttonLeftBackgroundColorPickerRef}
                            name="buttonLeftBackgroundColor"
                            value={formData.buttonLeftBackgroundColor}
                            onChange={handleColorChange}
                            style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                          />
                        }
                        error={formErrors.buttonLeftBackgroundColor}
                      />
                    </div>
                    <div style={colorFieldStyles(formData.buttonLeftTextColor)}>
                      <TextField
                        label="Button Left Text Color"
                        name="buttonLeftTextColor"
                        value={formData.buttonLeftTextColor}
                        onChange={(value) => handleChange('buttonLeftTextColor', value)}
                        connectedRight={
                          <input
                            type="color"
                            ref={buttonLeftTextColorPickerRef}
                            name="buttonLeftTextColor"
                            value={formData.buttonLeftTextColor}
                            onChange={handleColorChange}
                            style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                          />
                        }
                        error={formErrors.buttonLeftTextColor}
                      />
                    </div>
                    <TextField
                      label="Button Label Right"
                      name="buttonLabelRight"
                      value={formData.buttonLabelRight}
                      onChange={(value) => handleChange('buttonLabelRight', value)}
                      required
                      error={formErrors.buttonLabelRight}
                    />
                    <div style={colorFieldStyles(formData.buttonRightBackgroundColor)}>
                      <TextField
                        label="Button Right Background Color"
                        name="buttonRightBackgroundColor"
                        value={formData.buttonRightBackgroundColor}
                        onChange={(value) => handleChange('buttonRightBackgroundColor', value)}
                        connectedRight={
                          <input
                            type="color"
                            ref={buttonRightBackgroundColorPickerRef}
                            name="buttonRightBackgroundColor"
                            value={formData.buttonRightBackgroundColor}
                            onChange={handleColorChange}
                            style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                          />
                        }
                        error={formErrors.buttonRightBackgroundColor}
                      />
                    </div>
                    <div style={colorFieldStyles(formData.buttonRightTextColor)}>
                      <TextField
                        label="Button Right Text Color"
                        name="buttonRightTextColor"
                        value={formData.buttonRightTextColor}
                        onChange={(value) => handleChange('buttonRightTextColor', value)}
                        connectedRight={
                          <input
                            type="color"
                            ref={buttonRightTextColorPickerRef}
                            name="buttonRightTextColor"
                            value={formData.buttonRightTextColor}
                            onChange={handleColorChange}
                            style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                          />
                        }
                        error={formErrors.buttonRightTextColor}
                      />
                    </div>
                    <TextField
                      label="Popup Title"
                      name="popupTitle"
                      value={formData.popupTitle}
                      onChange={(value) => handleChange('popupTitle', value)}
                      required
                      error={formErrors.popupTitle}
                    />
                    <div style={colorFieldStyles(formData.headerBackgroundColor)}>
                      <TextField
                        label="Header Background Color"
                        name="headerBackgroundColor"
                        value={formData.headerBackgroundColor}
                        onChange={(value) => handleChange('headerBackgroundColor', value)}
                        connectedRight={
                          <input
                            type="color"
                            ref={headerBackgroundColorPickerRef}
                            name="headerBackgroundColor"
                            value={formData.headerBackgroundColor}
                            onChange={handleColorChange}
                            style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                          />
                        }
                        error={formErrors.headerBackgroundColor}
                      />
                    </div>
                    <div style={colorFieldStyles(formData.bodyBackgroundColor)}>
                      <TextField
                        label="Body Background Color"
                        name="bodyBackgroundColor"
                        value={formData.bodyBackgroundColor}
                        onChange={(value) => handleChange('bodyBackgroundColor', value)}
                        connectedRight={
                          <input
                            type="color"
                            ref={bodyBackgroundColorPickerRef}
                            name="bodyBackgroundColor"
                            value={formData.bodyBackgroundColor}
                            onChange={handleColorChange}
                            style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                          />
                        }
                        error={formErrors.bodyBackgroundColor}
                      />
                    </div>
                    <TextField
                      label="Content Title"
                      name="contentTitle"
                      value={formData.contentTitle}
                      onChange={(value) => handleChange('contentTitle', value)}
                      error={formErrors.contentTitle}
                    />
                    <div style={colorFieldStyles(formData.contentTitleColor)}>
                      <TextField
                        label="Content Title Color"
                        name="contentTitleColor"
                        value={formData.contentTitleColor}
                        onChange={(value) => handleChange('contentTitleColor', value)}
                        connectedRight={
                          <input
                            type="color"
                            ref={contentTitleColorPickerRef}
                            name="contentTitleColor"
                            value={formData.contentTitleColor}
                            onChange={handleColorChange}
                            style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                          />
                        }
                        error={formErrors.contentTitleColor}
                      />
                    </div>
                    <TextField
                      label="Content Subtitle"
                      name="contentSubtitle"
                      value={formData.contentSubtitle}
                      onChange={(value) => handleChange('contentSubtitle', value)}
                      multiline={4}
                      required
                      error={formErrors.contentSubtitle}
                    />
                    <div style={colorFieldStyles(formData.contentSubtitleColor)}>
                      <TextField
                        label="Content Subtitle Color"
                        name="contentSubtitleColor"
                        value={formData.contentSubtitleColor}
                        onChange={(value) => handleChange('contentSubtitleColor', value)}
                        connectedRight={
                          <input
                            type="color"
                            ref={contentSubtitleColorPickerRef}
                            name="contentSubtitleColor"
                            value={formData.contentSubtitleColor}
                            onChange={handleColorChange}
                            style={{ width: 32, height: 32, border: '1px solid #767676', padding: 0, background: 'none' }}
                          />
                        }
                        error={formErrors.contentSubtitleColor}
                      />
                    </div>
                    <Select
                      label="Under-Age Notice Type"
                      name="underAgeNoticeType"
                      options={[
                        { label: 'Show Message', value: 'show_message' },
                        { label: 'Redirect URL', value: 'redirect_url' },
                      ]}
                      value={formData.underAgeNoticeType}
                      onChange={(value) => handleChange('underAgeNoticeType', value)}
                      error={formErrors.underAgeNoticeType}
                    />
                    {showUnderAgeMessage && (
                      <TextField
                        label="Under-Age Message"
                        name="underAgeMessage"
                        value={formData.underAgeMessage}
                        onChange={(value) => handleChange('underAgeMessage', value)}
                        multiline={4}
                        placeholder="Enter message for under-age users"
                        required
                        error={formErrors.underAgeMessage}
                      />
                    )}
                    {showRedirectUrl && (
                      <TextField
                        label="Redirect URL"
                        name="redirectUrl"
                        value={formData.redirectUrl}
                        onChange={(value) => handleChange('redirectUrl', value)}
                        placeholder="Enter redirect URL for under-age users"
                        required
                        error={formErrors.redirectUrl}
                      />
                    )}
                    <div>
                      <label style={{ marginBottom: '8px', display: 'block' }}>Icon Image</label>
                      <input
                        type="file"
                        name="iconImage"
                        id="iconImage"
                        accept="image/jpeg,image/png,image/gif"
                        onChange={handleFileChange}
                      />
                      <div style={{ marginTop: '4px', color: '#6d7175', fontSize: '12px' }}>
                        Choose the icon to upload (JPEG, GIF, PNG).
                      </div>
                      <span>{fileName}</span>
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
                    <Button
                      primary
                      submit
                      loading={navigation.state === 'submitting'}
                      disabled={navigation.state === 'submitting'}
                    >
                      {navigation.state === "submitting" ? "Saving..." : "Save Settings"}
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

export default AgeVerificationSettings;