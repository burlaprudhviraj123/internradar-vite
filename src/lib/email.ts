import emailjs from '@emailjs/browser';

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export async function sendUrgencyEmail(
  userEmail: string,
  userName: string,
  companyName: string,
  role: string,
  deadline: string,
  applicationLink: string
): Promise<boolean> {
  // If keys aren't configured, gracefully fail so the app doesn't crash
  if (!serviceId || !templateId || !publicKey) {
    console.warn('EmailJS is not configured. Urgency email skipped.');
    return false;
  }

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: userEmail,
        to_name: userName,
        company_name: companyName,
        role: role,
        deadline: deadline,
        application_link: applicationLink || 'Not provided',
      },
      publicKey
    );
    return true;
  } catch (error) {
    console.error('Failed to send urgency email via EmailJS:', error);
    return false;
  }
}
