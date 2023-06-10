export const mailFormat = {
  ChangeEmailCompleatForNEWEmail: {
    subject: 'Email Update Notice',
    body: 'Email update completed.'
  },
  ChangePasswordCompleat: {
    subject: 'Password Update Notice',
    body: 'Password update completed.'
  },
  CreateCompleat: {
    subject: 'Your Registration is Complete',
    body: 'Dear {{name}}.\nThank you for joining us, your account is now active and ready to use.'
  },
  deletionCompleat: {
    subject: 'Account Deletion Confirmation',
    body: 'Dear {{name}}.\nYour account has been deleted. Thank you for being a part of our community.'
  },
  LoginCompleat: {
    subject: 'Login Notification',
    body: 'Dear {{name}}\nThank you for logging in to our system.'
  },
} as const
