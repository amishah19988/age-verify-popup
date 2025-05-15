import { json, redirect } from '@remix-run/node';
import { Form, useLoaderData, useActionData, useNavigation, useSubmit, useNavigate } from '@remix-run/react';
import { Frame, Page, Toast, Card, Button, Text, Modal, Banner } from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import prisma from '../db.server';
import React, { useState, useEffect } from 'react';

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    if (!session?.shop) {
      throw new Error('Shop not found in session');
    }

    const shop = session.shop;
    const account = await prisma.account.findFirst({
      where: { shop },
    });

    if (!account) {
      return json({
        account: null,
        shop,
      });
    }

    return json({
      account,
      shop,
    });
  } catch (error) {
    return json({
      account: null,
      shop: null,
      error: 'Failed to load account information',
    }, { status: 500 });
  }
};

export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    if (!session?.shop) {
      return redirect('/auth/login');
    }

    const shop = session.shop;
    const formData = await request.formData();
    const actionType = formData.get('action');

    if (actionType === 'deleteAccount') {
      const account = await prisma.account.findFirst({
        where: { shop },
      });

      if (!account) {
        return json({
          success: false,
          error: 'Account not found',
        }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.AgeVerificationRules.deleteMany({
          where: { shop },
        });

        await tx.AgeVerificationSettings.deleteMany({
          where: { shop },
        });

        await tx.account.delete({
          where: { id: account.id },
        });
      });

      // Return a success response instead of redirecting immediately
      return json({
        success: true,
        deleteSuccess: true, // Flag to indicate account deletion
        message: 'Account deleted successfully',
      }, { status: 200 });
    }

    const username = formData.get('username');
    const email = formData.get('email');

    if (!username || !email) {
      return json({ success: false, error: 'Username and email are required' }, { status: 400 });
    }

    const existingAccount = await prisma.account.findFirst({
      where: { shop },
    });

    if (existingAccount) {
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          username,
          email,
          updatedat: new Date(),
        },
      });
    } else {
      await prisma.account.create({
        data: {
          username,
          email,
          shop,
          serialkey: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          createdat: new Date(),
          updatedat: new Date(),
        },
      });
    }

    return json({ success: true, message: 'Account updated successfully' }, { status: 200 });
  } catch (error) {
    return json({
      success: false,
      error: `Operation failed: ${error.message}`,
    }, { status: 500 });
  }
};

const AccountSettings = () => {
  const loaderData = useLoaderData() || {};
  const { account, shop, error } = loaderData;
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const navigate = useNavigate(); // For client-side navigation
  const [showToast, setShowToast] = useState(false);
  const [formChanged, setFormChanged] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [formData, setFormData] = useState({
    username: account?.username || '',
    email: account?.email || '',
    serialkey: account?.serialkey || '',
  });

  useEffect(() => {
    if (actionData && navigation.state === 'idle') {
      setShowToast(true);
      setFormChanged(false);

      // Handle account deletion success
      if (actionData.deleteSuccess) {
        setFormData({
          username: '',
          email: '',
          serialkey: '',
        });
        // Redirect to /app after a delay to allow the toast to be visible
        setTimeout(() => {
          navigate('/app');
        }, 2000); // 2-second delay to show the toast
      }
    }
  }, [actionData, navigation.state, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setFormChanged(true);
  };

  const handleDiscard = () => {
    setFormData({
      username: account?.username || '',
      email: account?.email || '',
      serialkey: account?.serialkey || '',
    });
    setFormChanged(false);
  };

  const handleDeleteAccount = () => {
    submit(
      { action: 'deleteAccount' },
      { method: 'post' },
    );
    setShowDeleteModal(false);
  };

  const toastMarkup = showToast && (
    <Toast
      content={actionData?.message || (actionData?.success ? 'Changes saved successfully' : 'An error occurred')}
      error={!actionData?.success}
      onDismiss={() => setShowToast(false)}
    />
  );

  const deleteModal = (
    <Modal
      open={showDeleteModal}
      onClose={() => setShowDeleteModal(false)}
      title="Delete Account"
      primaryAction={{
        content: 'Delete',
        destructive: true,
        onAction: handleDeleteAccount,
        loading: navigation.state === 'submitting',
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: () => setShowDeleteModal(false),
        },
      ]}
    >
      <Modal.Section>
        <Text as="p">
          Are you sure you want to delete your account? This will remove all associated data (settings, rules) and cannot be undone.
        </Text>
      </Modal.Section>
    </Modal>
  );

  if (error) {
    return (
      <Frame>
        <Page title="Account Settings">
          <Card sectioned>
            <Text variant="headingMd" as="h2" color="critical">
              Error Loading Account Information
            </Text>
            <Text as="p" color="critical">
              {error}. Please try refreshing the page or contact support if the issue persists.
            </Text>
          </Card>
        </Page>
      </Frame>
    );
  }

  if (!shop && !error) {
    return (
      <Frame>
        <Page title="Account Settings">
          <Card sectioned>
            <Text variant="headingMd" as="h2">
              Loading Account Information...
            </Text>
          </Card>
        </Page>
      </Frame>
    );
  }

  return (
    <Frame>
      <Page title="Account Settings">
        {deleteModal}
        {toastMarkup}
        <Card sectioned title="Account Information">
          <Form method="post">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Serial Key
                </label>
                <input
                  type="text"
                  value={formData.serialkey}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #dfe3e8',
                    borderRadius: '4px',
                    fontSize: '14px',
                    background: '#f5f5f5',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #dfe3e8',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #dfe3e8',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              {formChanged && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <Button onClick={handleDiscard}>
                    Discard
                  </Button>
                  <Button
                    primary
                    submit
                    loading={navigation.state === 'submitting'}
                    disabled={navigation.state === 'submitting'}
                  >
                    Save Changes
                  </Button>
                </div>
              )}

              <Banner status="warning">
                <p>
                  Deleting your account will remove all your data permanently.
                  <Button
                    plain
                    destructive
                    onClick={() => setShowDeleteModal(true)}
                    style={{ marginLeft: '8px' }}
                  >
                    Delete Account
                  </Button>
                </p>
              </Banner>
            </div>
          </Form>
        </Card>
      </Page>
    </Frame>
  );
};

export default AccountSettings;