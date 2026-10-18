import { ZatcaConfig } from '../src/app/modules/Zatca/zatca.model';
import { ZatcaOnboardingService } from '../src/app/modules/Zatca/services/zatcaOnboarding.service';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function runTest() {
  await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/sheemah_pos');
  const cfg = await ZatcaConfig.findOne({ branchId: 'MAIN-BRANCH' });
  if (!cfg) throw new Error('No config found');

  console.log('Environment:', cfg.environment);
  console.log('Compliance CSID present:', !!cfg.complianceCsid);
  console.log('Compliance Secret present:', !!cfg.complianceSecret);
  console.log('Compliance Request ID:', cfg.complianceRequestId);

  const onboardingService = new ZatcaOnboardingService();
  try {
    const res = await onboardingService.runComplianceTests(cfg);
    console.log('Compliance tests result:', JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.error('Compliance tests threw error:', err);
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
