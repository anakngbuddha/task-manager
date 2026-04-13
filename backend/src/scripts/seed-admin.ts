import { prisma } from '../lib/prisma.js'
import { auth } from '../lib/auth.js'

export async function seedAdmin() {
  const email = 'markvalerio@admin.com'
  const password = '#Jenacute1109'

  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    })

    if (!existingAdmin) {
      console.log('Seeding admin user...')
      // Try to create via better-auth server side api
      try {
        await auth.api.signUpEmail({
          headers: new Headers(),
          body: {
            email,
            password,
            name: 'Master Admin',
          }
        })
        
        // After creation, manually update role and email verification
        await prisma.user.update({
          where: { email },
          data: {
            role: 'admin',
            emailVerified: true
          }
        })
        console.log('Admin user seeded successfully.')
      } catch (err) {
        console.error('Error creating admin account via auth API', err)
      }
    } else if (existingAdmin.role !== 'admin') {
      // Provide an upgrade path in case user exists but isn't admin
      console.log('Admin user exists, ensuring admin role and verified status.')
      await prisma.user.update({
        where: { email },
        data: { role: 'admin', emailVerified: true }
      })
    }
  } catch (error) {
    console.error('Failed to seed admin', error)
  }
}
