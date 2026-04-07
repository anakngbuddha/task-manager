/**
 * Quick Brevo email test - run with:
 *   node test-email.mjs your@email.com
 */
import { BrevoClient } from '@getbrevo/brevo'
import 'dotenv/config'

const to = process.argv[2]
if (!to) {
  console.error('Usage: node test-email.mjs your@email.com')
  process.exit(1)
}

console.log('BREVO_API_KEY present:', !!process.env.BREVO_API_KEY)
console.log('FROM_EMAIL:', process.env.EMAIL_FROM_ADDRESS)
console.log('FROM_NAME:', process.env.EMAIL_FROM_NAME)
console.log('Sending test email to:', to)

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY || '',
})

try {
  const result = await brevo.transactionalEmails.sendTransacEmail({
    sender: {
      name: process.env.EMAIL_FROM_NAME || 'We Work IT',
      email: process.env.EMAIL_FROM_ADDRESS || 'markvalerio44@gmail.com',
    },
    to: [{ email: to }],
    subject: 'Brevo Test Email',
    htmlContent: '<h1>It works!</h1><p>Brevo is correctly configured.</p>',
  })
  console.log('\n✅ Email sent successfully!')
  console.log('Response:', JSON.stringify(result, null, 2))
} catch (err) {
  console.error('\n❌ Failed to send email:')
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err
    console.error('Status:', e.response?.status)
    console.error('Body:', JSON.stringify(e.response?.data ?? e.response?.body, null, 2))
  } else {
    console.error(err)
  }
}
