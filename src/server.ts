import app from './app';
import config from './app/config';
import { connectDB } from './app/DB/connection';

async function main() {
  try {
    await connectDB();
    const port = Number(config.port) || 5100;
    const host = process.env.HOST || '0.0.0.0';
    app.listen(port, () => {
      console.log(`Baqalat Sheemah Khulaif Aayed POS listening on port ${port}`);
    });
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}

// Start standalone server on localhost or cPanel unless running inside Vercel serverless
if (!process.env.VERCEL) {
  void main();
}

// Export for Vercel serverless
export default app;
