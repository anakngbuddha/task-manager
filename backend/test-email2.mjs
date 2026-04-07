import 'dotenv/config'
import { BrevoClient } from '@getbrevo/brevo'

const apiKey = process.env.BREVO_API_KEY
console.log('KEY starts with:', apiKey ? apiKey.slice(0, 25) + '...' : 'MISSING')
console.log('FROM_ADDR:', process.env.EMAIL_FROM_ADDRESS)
console.log('FROM_NAME:', process.env.EMAIL_FROM_NAME)

const b = new BrevoClient({ apiKey })

try {
  const r = await b.transactionalEmails.sendTransacEmail({
    sender: { name: process.env.EMAIL_FROM_NAME, email: process.env.EMAIL_FROM_ADDRESS },
    to: [{ email: 'markvalerio44@gmail.com' }],
    subject: 'Test Email - Task Manager',
    htmlContent: '<p>Brevo test success!</p>'
  })
  console.log('SUCCESS:', JSON.stringify(r))
} catch (e) {
  const allProps = Object.getOwnPropertyNames(e)
  for (const p of allProps) {
    try {
      const val = e[p]
      if (typeof val === 'object') {
        process.stdout.write(p + ': ' + JSON.stringify(val) + '\n')
      } else {
        process.stdout.write(p + ': ' + String(val).slice(0, 400) + '\n')
      }
    } catch (_) {}
  }
}
