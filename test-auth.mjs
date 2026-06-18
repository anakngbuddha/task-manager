async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' })
    });
    console.log('Status:', res.status);
    console.log('Headers:', [...res.headers.entries()]);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
