import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { ZatcaServices } from '../src/app/modules/Zatca/zatca.service';

dotenv.config();

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function runCli() {
  console.log('\n=============================================================');
  console.log('   ZATCA Phase 2 (E-Invoicing) Device Onboarding CLI');
  console.log('   هيئة الزكاة والضريبة والجمارك - الربط والتكامل المباشر');
  console.log('=============================================================\n');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL not set in .env');
    process.exit(1);
  }

  console.log('⏳ Connecting to MongoDB Atlas...');
  await mongoose.connect(dbUrl);
  console.log('✓ Connected to MongoDB.\n');

  // Parse args
  let otp = '';
  let env = 'sandbox';

  process.argv.forEach((arg) => {
    if (arg.startsWith('--otp=')) otp = arg.split('=')[1];
    if (arg.startsWith('--env=')) env = arg.split('=')[1];
  });

  if (!otp) {
    otp = await askQuestion('Enter 6-digit OTP from ZATCA Fatoora Portal (أدخل رمز OTP): ');
  }

  if (otp.length !== 6) {
    console.error('❌ Error: OTP must be exactly 6 digits.');
    process.exit(1);
  }

  if (!['sandbox', 'simulation', 'production'].includes(env)) {
    const envInput = await askQuestion('Select Environment [1: Sandbox (default), 2: Production]: ');
    env = envInput === '2' ? 'production' : 'sandbox';
  }

  console.log(`\nStarting Onboarding in [${env.toUpperCase()}] mode with OTP [${otp}]...`);

  try {
    const result = await ZatcaServices.onboardDevice({
      branchId: 'MAIN-BRANCH',
      deviceName: 'POS Terminal 01',
      otp,
      environment: env,
      vatNumber: '311111111111113',
      taxpayerName: 'بقالة شيمه خليف عايد العنزي للمواد الغذائية',
      branchName: 'Main Branch',
      businessCategory: 'Food & Beverage',
      crn: '1010101010',
      streetName: 'خميس مشيط - مخطط الحسام',
      buildingNumber: '1234',
      cityName: 'Khamis Mushait',
      postalCode: '62461',
    });

    console.log('\n🎉 SUCCESS! Device Onboarded with ZATCA Phase 2:');
    console.log('   - Branch ID:          ', result.branchId);
    console.log('   - Status:             ', result.status);
    console.log('   - Environment:        ', result.environment);
    console.log('   - Production Req ID:  ', result.productionRequestId);
    console.log('   - Onboarded At:       ', result.onboardedAt);
    console.log('\nReady! All sales will now be compliant with ZATCA Phase 2.\n');
  } catch (err: any) {
    console.error('\n❌ Onboarding Failed:', err.message || err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runCli();
