const fs = require('fs');
const content = fs.readFileSync('C:/Users/User/.gemini/antigravity-ide/brain/76dc1054-faaa-4dd3-bfa6-5d207b00c4a7/scratch/package/lib/samples/index.js', 'utf8');
const match = content.match(/<xades:SignedProperties[\s\S]*?<\/xades:SignedProperties>/);
console.log('Sample SignedProperties in XML:');
console.log(JSON.stringify(match[0]));

const mod = require('C:/Users/User/.gemini/antigravity-ide/brain/76dc1054-faaa-4dd3-bfa6-5d207b00c4a7/scratch/package/lib/zatca/templates/ubl_extension_signed_properties_template');
const forSigning = mod.defaultUBLExtensionsSignedPropertiesForSigning({
  sign_timestamp: '2022-09-10T22:19:53Z',
  certificate_hash: 'NjlhOTVmYzIzN2I0MjcxNGRjNDQ1N2EzM2I5NGNjNDUyZmQ5ZjExMDUwNGM2ODNjNDAxMTQ0ZDk1NDQ4OTRmYg==',
  certificate_issuer: 'CN=TSZEINVOICE-SubCA-1, DC=extgazt, DC=gov, DC=local',
  certificate_serial_number: '2475382876776561391517206651645660279462721580'
});
console.log('\nforSigning string:');
console.log(JSON.stringify(forSigning));

const afterSigning = mod.default({
  sign_timestamp: '2022-09-10T22:19:53Z',
  certificate_hash: 'NjlhOTVmYzIzN2I0MjcxNGRjNDQ1N2EzM2I5NGNjNDUyZmQ5ZjExMDUwNGM2ODNjNDAxMTQ0ZDk1NDQ4OTRmYg==',
  certificate_issuer: 'CN=TSZEINVOICE-SubCA-1, DC=extgazt, DC=gov, DC=local',
  certificate_serial_number: '2475382876776561391517206651645660279462721580'
});
console.log('\nafterSigning string:');
console.log(JSON.stringify(afterSigning));
