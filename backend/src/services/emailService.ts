import { Resend } from 'resend';
import { config } from '../config/environment';

const resend = new Resend(config.resendApiKey || 're_123456789'); // Provide dummy key to prevent crash if missing

export const emailService = {
  async sendWelcomeEmail(email: string, name: string) {
    if (!config.resendApiKey) {
        console.warn('Resend API Key is missing. Email not sent.');
        return null;
    }
    try {
      const data = await resend.emails.send({
        from: 'Adaptive Learning <onboarding@resend.dev>', // Use 'onboarding@resend.dev' for testing if you don't have a domain
        to: [email],
        subject: 'Welcome to Adaptive Learning Platform!',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome, ${name}!</h2>
            <p>We are thrilled to have you on board. Get ready to experience a personalized learning journey powered by AI.</p>
            <p>Here are a few things you can do to get started:</p>
            <ul>
              <li>Explore our adaptive courses</li>
              <li>Take a quiz to test your knowledge</li>
              <li>Check your personalized dashboard</li>
            </ul>
            <p>Happy Learning!</p>
            <p>The Adaptive Learning Team</p>
          </div>
        `,
      });

      console.log('Welcome email sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Don't throw error to prevent blocking the registration process
      return null;
    }
  },

  async sendCourseEnrollmentEmail(email: string, name: string, courseTitle: string) {
    if (!config.resendApiKey) return null;
    try {
      const data = await resend.emails.send({
        from: 'Adaptive Learning <onboarding@resend.dev>',
        to: [email],
        subject: `Enrolled in: ${courseTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>You have successfully enrolled in <strong>${courseTitle}</strong>.</p>
            <p>We wish you the best of luck in your studies!</p>
            <p>The Adaptive Learning Team</p>
          </div>
        `,
      });
      return data;
    } catch (error) {
      console.error('Error sending enrollment email:', error);
      return null;
    }
  }
};
