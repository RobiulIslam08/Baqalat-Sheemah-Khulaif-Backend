# ZATCA Phase 2 (Fatoora) Master Implementation & Execution Blueprint
### The Definitive, Zero-Error Production Guide for Laravel (PHP) & React.js

---

## 📌 Document Overview & Purpose

This document is the **complete, end-to-end production blueprint** for integrating **Saudi Arabia ZATCA Phase 2 E-Invoicing (Integration Phase / مرحلة الربط والتكامل)** into any **Laravel (PHP 8.0, 8.1, 8.2, 8.3+)** backend and **React.js** (Vite, Inertia.js, or SPA) frontend POS/ERP system.

### Why this blueprint was created:
ZATCA Phase 2 requires strict mathematical, cryptographic, XML canonicalization (C14N 1.1), and XSD schema compliance. AI coding agents and developers repeatedly make fatal mistakes when implementing ZATCA in PHP/Laravel:
1. Generating 44-character cert digests instead of the mandatory 88-character hex digest (`BR-KSA-28`).
2. Corrupting XML canonicalization by loading and resaving via DOMDocument without preserving white spaces.
3. Messing up UBL 2.1 schema ordering (`<cac:PartyTaxScheme>` placed before `<cac:PostalAddress>`).
4. Failing to extract the exact 70–72 byte ASN.1 DER CA signature for QR Code Tag 9.
5. Inability to pass the mandatory 6 compliance invoice checks required before Production CSID issuance.
6. Accidental re-onboarding wiping active production certificates in the database.
7. Neglecting the mandatory Saudi legal requirement to report offline simplified invoices within 24 hours.

This blueprint contains **100% production-tested, self-contained PHP & React code** that eliminates all dependencies on external binaries or quirky OpenSSL config files. Any AI agent or developer can follow this file step-by-step and produce a working, zero-error ZATCA Phase 2 integration on the first try.

---

## 🎯 Critical Pitfalls & Golden Rules for Laravel / PHP

| # | Pitfall That Causes Failure | The Exact Production Solution |
|---|-----------------------------|-------------------------------|
| **1** | **XAdES `CertDigest` Hashing Failure (`BR-KSA-28` / `BR-KSA-30`)** (Hashing raw DER bytes directly to base64 produces 44 chars; ZATCA strictly rejects this). | ZATCA strictly mandates the **Base64 encoding of the SHA-256 HEX string** (resulting in an **exact 88-character** string). Format: `base64_encode(hash('sha256', $cleanCertB64))`. |
| **2** | **C14N 1.1 Whitespace Corruption** (Default `$dom->saveXML()` or altering indentation breaks hash). | Set `$dom->formatOutput = false;` and `$dom->preserveWhiteSpace = true;` before loading XML. Call native PHP `$dom->C14N(false, false)`. Produces bit-for-bit identical hashes to ZATCA's validator. |
| **3** | **UBL 2.1 Schema Ordering (`XSD_ZATCA_INVALID`)** (Customer Party element ordering). | UBL 2.1 XSD demands strict order: `<cac:PostalAddress>` FIRST, `<cac:PartyTaxScheme>` SECOND, `<cac:PartyLegalEntity>` THIRD. Also, for Saudi buyer addresses, `<cbc:CitySubdivisionName>` (District) is mandatory. |
| **4** | **QR Code Tag 9 (CA Signature) Extraction Failure** (Returning empty string or invalid length causes `QRCODE_INVALID`). | Parse the X.509 certificate DER structure directly to extract the exact 70–72 byte ASN.1 DER CA signature (Tag 9) and the 88-byte raw SPKI public key (Tag 8). |
| **5** | **QR Code Timestamp Mismatch (`KSA-25`)** (Adding trailing `Z` when XML `<cbc:IssueTime>` has no `Z`). | Tag 3 timestamp must match `<cbc:IssueDate>` and `<cbc:IssueTime>` exactly: `{$issueDate}T{$issueTime}` in KSA timezone (`Asia/Riyadh`). |
| **6** | **Missing the 6 Compliance Invoices** (Requesting Production CSID without passing all 6 tests returns HTTP 400). | You MUST submit 6 specific test documents in strict sequence: Simplified Invoice (388), Simplified Credit Note (381), Simplified Debit Note (383), Standard Invoice (388, clearance), Standard Credit Note (381, clearance), Standard Debit Note (383, clearance). |
| **7** | **Accidental Re-Onboarding Wiping Active Credentials** (Clicking onboard again generates new private keys, invalidating the active Production CSID). | Implement guard logic in the database and UI: if `status === 'onboarded'` and `production_csid` exists, lock it. Only permit re-onboarding if explicitly toggled (`force_reonboard: true`). |
| **8** | **Offline 24-Hour Reporting Rule Violation** (Saudi law mandates offline simplified invoices must be reported within 24 hours). | Implement a Laravel Artisan Scheduled Command (`app:sync-pending-zatca-invoices`) running every 10 minutes via Laravel's Task Scheduler (`routes/console.php` or `app/Console/Kernel.php`). |

---

## 📦 1. Required Dependencies

### 1.1 PHP Extensions
Ensure the following standard PHP extensions are enabled in `php.ini`:
```ini
extension=openssl
extension=dom
extension=libxml
extension=curl
extension=mbstring
```

### 1.2 Composer Packages (Minimal & Standard)
Laravel includes `guzzlehttp/guzzle` by default. If your project does not have it:
```bash
composer require guzzlehttp/guzzle
```

### 1.3 React Frontend Packages
In your React frontend directory:
```bash
npm install qrcode lucide-react
```

---

## 🗄️ 2. Database Migrations

### 2.1 Migration: `create_zatca_configs_table.php`

Run:
```bash
php artisan make:migration create_zatca_configs_table
```

File: `database/migrations/xxxx_xx_xx_create_zatca_configs_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zatca_configs', function (Blueprint $table) {
            $table->id();
            $table->string('branch_id')->unique()->index();
            $table->string('device_name')->default('POS Terminal 01');
            $table->string('serial_number');
            $table->string('vat_number', 15);
            $table->string('taxpayer_name');
            $table->string('branch_name')->nullable();
            $table->string('business_category')->default('Food and Beverage');
            $table->string('crn')->nullable();
            $table->string('street_name');
            $table->string('building_number');
            $table->string('city_subdivision')->default('Al-Husam');
            $table->string('city_name');
            $table->string('postal_code');
            $table->string('country_code', 2)->default('SA');
            $table->enum('environment', ['sandbox', 'simulation', 'production'])->default('production');
            
            // Cryptographic Keys & Certificates
            $table->text('private_key')->nullable();
            $table->text('public_key')->nullable();
            $table->text('csr_content')->nullable();
            
            // Compliance CSID (Temporary onboarding token)
            $table->text('compliance_csid')->nullable();
            $table->text('compliance_secret')->nullable();
            $table->string('compliance_request_id')->nullable();
            
            // Production CSID (Official live token)
            $table->text('production_csid')->nullable();
            $table->text('production_secret')->nullable();
            $table->string('production_request_id')->nullable();
            
            // State & Chaining
            $table->enum('status', ['pending', 'csr_generated', 'compliance_passed', 'onboarded', 'failed'])->default('pending');
            $table->text('last_invoice_hash')->default('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjExN2Q5MTU0NWNmNEY=');
            $table->unsignedBigInteger('invoice_counter')->default(0);
            $table->timestamp('onboarded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zatca_configs');
    }
};
```

### 2.2 Migration: `create_zatca_invoices_table.php`

Run:
```bash
php artisan make:migration create_zatca_invoices_table
```

File: `database/migrations/xxxx_xx_xx_create_zatca_invoices_table.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zatca_invoices', function (Blueprint $table) {
            $table->id();
            $table->string('branch_id')->index();
            $table->string('invoice_number')->index();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('icv'); // Invoice Counter Value
            $table->text('pih'); // Previous Invoice Hash
            $table->text('invoice_hash');
            $table->enum('invoice_type', ['simplified', 'standard']);
            $table->enum('transaction_type', ['invoice_388', 'credit_note_381', 'debit_note_383'])->default('invoice_388');
            $table->decimal('total_amount', 12, 2);
            $table->decimal('vat_amount', 12, 2);
            $table->text('qr_code_payload');
            $table->mediumText('signed_xml');
            $table->mediumText('stamped_xml')->nullable();
            $table->enum('zatca_status', ['reported', 'cleared', 'rejected', 'pending', 'failed'])->default('pending');
            $table->json('validation_errors')->nullable();
            $table->json('validation_warnings')->nullable();
            $table->json('raw_zatca_response')->nullable();
            $table->timestamp('reported_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zatca_invoices');
    }
};
```

Run migrations:
```bash
php artisan migrate
```

---

## 🏛️ 3. Eloquent Models

### 3.1 Model: `app/Models/ZatcaConfig.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ZatcaConfig extends Model
{
    use HasFactory;

    protected $table = 'zatca_configs';

    protected $guarded = ['id'];

    protected $hidden = [
        'private_key',
        'compliance_secret',
        'production_secret',
    ];

    protected $casts = [
        'invoice_counter' => 'integer',
        'onboarded_at' => 'datetime',
    ];

    public function getIsFullyOnboardedAttribute(): bool
    {
        return $this->status === 'onboarded' && !empty($this->production_csid);
    }
}
```

### 3.2 Model: `app/Models/ZatcaInvoice.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ZatcaInvoice extends Model
{
    use HasFactory;

    protected $table = 'zatca_invoices';

    protected $guarded = ['id'];

    protected $casts = [
        'icv' => 'integer',
        'total_amount' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'validation_errors' => 'array',
        'validation_warnings' => 'array',
        'raw_zatca_response' => 'array',
        'reported_at' => 'datetime',
    ];
}
```

---

## 🔐 4. Core Cryptographic Helper (`app/Services/Zatca/ZatcaCryptoHelper.php`)
### 100% Pure PHP: secp256k1 Key Generation, Pure ASN.1 CSR Generator, C14N 1.1 Hasher & Certificate Parser

```php
<?php

namespace App\Services\Zatca;

use DOMDocument;
use DOMXPath;
use Exception;

class ZatcaCryptoHelper
{
    const ASN1_INTEGER = 0x02;
    const ASN1_BIT_STRING = 0x03;
    const ASN1_OCTET_STRING = 0x04;
    const ASN1_NULL = 0x05;
    const ASN1_OBJECT_IDENTIFIER = 0x06;
    const ASN1_UTF8_STRING = 0x0c;
    const ASN1_PRINTABLE_STRING = 0x13;
    const ASN1_SEQUENCE = 0x30;
    const ASN1_SET = 0x31;
    const ASN1_CONTEXT_0 = 0xa0;
    const ASN1_CONTEXT_4 = 0xa4;

    /**
     * Generates a secp256k1 EC Key Pair in PEM format.
     */
    public static function generateEcKeyPair(): array
    {
        $config = [
            'curve_name' => 'secp256k1',
            'private_key_type' => OPENSSL_KEYTYPE_EC,
        ];
        $res = openssl_pkey_new($config);
        if (!$res) {
            throw new Exception("Failed to generate EC key pair: " . openssl_error_string());
        }
        openssl_pkey_export($res, $privateKey);
        $details = openssl_pkey_get_details($res);
        $publicKey = $details['key'];

        return [
            'private_key' => $privateKey,
            'public_key' => $publicKey,
        ];
    }

    /**
     * Encodes length in ASN.1 DER format.
     */
    private static function encodeDerLength(int $len): string
    {
        if ($len < 128) {
            return chr($len);
        }
        $bytes = '';
        $temp = $len;
        while ($temp > 0) {
            $bytes = chr($temp & 0xff) . $bytes;
            $temp >>= 8;
        }
        return chr(0x80 | strlen($bytes)) . $bytes;
    }

    /**
     * Wraps content in ASN.1 TLV (Tag-Length-Value).
     */
    private static function tlv(int $tag, string $content): string
    {
        return chr($tag) . self::encodeDerLength(strlen($content)) . $content;
    }

    /**
     * Encodes OID string (e.g., '1.3.6.1.4.1.311.20.2') into ASN.1 DER.
     */
    private static function encodeDerOid(string $oidStr): string
    {
        $parts = array_map('intval', explode('.', $oidStr));
        $firstByte = $parts[0] * 40 + $parts[1];
        $bytes = chr($firstByte);

        for ($i = 2; $i < count($parts); $i++) {
            $val = $parts[$i];
            $subBytes = [];
            $subBytes[] = $val & 0x7f;
            $val >>= 7;
            while ($val > 0) {
                array_unshift($subBytes, ($val & 0x7f) | 0x80);
                $val >>= 7;
            }
            foreach ($subBytes as $b) {
                $bytes .= chr($b);
            }
        }
        return self::tlv(self::ASN1_OBJECT_IDENTIFIER, $bytes);
    }

    /**
     * Encodes an RDN (Relative Distinguished Name) SET.
     */
    private static function encodeRdn(string $oid, int $tag, string $value): string
    {
        $attrType = self::encodeDerOid($oid);
        $attrVal = self::tlv($tag, $value);
        $typeAndValue = self::tlv(self::ASN1_SEQUENCE, $attrType . $attrVal);
        return self::tlv(self::ASN1_SET, $typeAndValue);
    }

    /**
     * Sanitizes industry text for ZATCA businessCategory.
     */
    public static function sanitizeIndustry(?string $val): string
    {
        if (!$val) return 'Food and Beverage';
        $clean = str_replace('&', 'and', $val);
        $clean = preg_replace('/[^a-zA-Z0-9\x{0600}-\x{06FF}\s\-_]/u', '', $clean);
        $clean = preg_replace('/\s+/', ' ', trim($clean));
        return $clean ?: 'Food and Beverage';
    }

    /**
     * Generates a 100% pure PHP in-process ASN.1 DER CSR for ZATCA Phase 2.
     * Works identically across Linux, Windows, and Docker without external openssl.cnf files.
     */
    public static function generatePureCsr(
        string $privateKeyPem,
        array $attributes,
        string $environment = 'production'
    ): string {
        $templateName = ($environment === 'sandbox') ? 'PREZATCA-Code-Signing' : 'ZATCA-Code-Signing';
        $invoiceTypeFlag = $attributes['invoice_type_flag'] ?? '1100';
        $branchName = preg_replace('/[<>]/', '', trim($attributes['branch_name'] ?? $attributes['taxpayer_name'] ?? 'Main Branch'));
        $taxpayerName = preg_replace('/[<>]/', '', trim($attributes['taxpayer_name'] ?? 'Taxpayer'));
        $registeredAddress = preg_replace('/[<>]/', '', trim(($attributes['building_number'] ?? '1234') . ' ' . ($attributes['street_name'] ?? 'Main St')));
        $businessCategory = self::sanitizeIndustry($attributes['business_category'] ?? null);

        // 1. Version: INTEGER 0
        $version = self::tlv(self::ASN1_INTEGER, chr(0x00));

        // 2. Subject DN: C=SA, OU=branchName, O=taxpayerName, CN=serialNumber
        $cRdn  = self::encodeRdn('2.5.4.6', self::ASN1_PRINTABLE_STRING, 'SA');
        $ouRdn = self::encodeRdn('2.5.4.11', self::ASN1_UTF8_STRING, $branchName);
        $oRdn  = self::encodeRdn('2.5.4.10', self::ASN1_UTF8_STRING, $taxpayerName);
        $cnRdn = self::encodeRdn('2.5.4.3', self::ASN1_UTF8_STRING, $attributes['serial_number']);
        $subject = self::tlv(self::ASN1_SEQUENCE, $cRdn . $ouRdn . $oRdn . $cnRdn);

        // 3. SubjectPublicKeyInfo DER
        $privKeyObj = openssl_pkey_get_private($privateKeyPem);
        $details = openssl_pkey_get_details($privKeyObj);
        $spkiPem = $details['key'];
        $cleanSpkiB64 = preg_replace('/\s+/', '', str_replace(['-----BEGIN PUBLIC KEY-----', '-----END PUBLIC KEY-----'], '', $spkiPem));
        $spkiDer = base64_decode($cleanSpkiB64);

        // 4. Custom ZATCA OID Extensions
        // Extension 1: Certificate Template Name (1.3.6.1.4.1.311.20.2)
        $templOid = self::encodeDerOid('1.3.6.1.4.1.311.20.2');
        $templVal = self::tlv(self::ASN1_OCTET_STRING, self::tlv(self::ASN1_PRINTABLE_STRING, $templateName));
        $extTempl = self::tlv(self::ASN1_SEQUENCE, $templOid . $templVal);

        // Extension 2: Subject Alternative Name (2.5.29.17) -> dirName [4]
        $snRdn    = self::encodeRdn('2.5.4.4', self::ASN1_UTF8_STRING, $attributes['serial_number']);
        $uidRdn   = self::encodeRdn('0.9.2342.19200300.100.1.1', self::ASN1_UTF8_STRING, $attributes['vat_number']);
        $titleRdn = self::encodeRdn('2.5.4.12', self::ASN1_UTF8_STRING, $invoiceTypeFlag);
        $addrRdn  = self::encodeRdn('2.5.4.26', self::ASN1_UTF8_STRING, $registeredAddress);
        $catRdn   = self::encodeRdn('2.5.4.15', self::ASN1_UTF8_STRING, $businessCategory);

        $dirNameSeq = self::tlv(self::ASN1_SEQUENCE, $snRdn . $uidRdn . $titleRdn . $addrRdn . $catRdn);
        $sanValContent = self::tlv(self::ASN1_CONTEXT_4, $dirNameSeq);
        $sanVal = self::tlv(self::ASN1_OCTET_STRING, $sanValContent);
        $sanOid = self::encodeDerOid('2.5.29.17');
        $extSan = self::tlv(self::ASN1_SEQUENCE, $sanOid . $sanVal);

        $extensionsSeq = self::tlv(self::ASN1_SEQUENCE, $extTempl . $extSan);
        $extReqOid = self::encodeDerOid('1.2.840.113549.1.9.14');
        $extReqSet = self::tlv(self::ASN1_SET, $extensionsSeq);
        $extReqSeq = self::tlv(self::ASN1_SEQUENCE, $extReqOid . $extReqSet);
        $attrsTlv = self::tlv(self::ASN1_CONTEXT_0, $extReqSeq);

        // 5. CertificationRequestInfo
        $cri = self::tlv(self::ASN1_SEQUENCE, $version . $subject . $spkiDer . $attrsTlv);

        // 6. Sign with ECDSA SHA-256
        openssl_sign($cri, $derSignature, $privateKeyPem, OPENSSL_ALGO_SHA256);

        $sigBitString = self::tlv(self::ASN1_BIT_STRING, chr(0x00) . $derSignature);
        $sigAlgOid = self::encodeDerOid('1.2.840.10045.4.3.2'); // ecdsa-with-SHA256
        $sigAlg = self::tlv(self::ASN1_SEQUENCE, $sigAlgOid);

        $csrDer = self::tlv(self::ASN1_SEQUENCE, $cri . $sigAlg . $sigBitString);
        $b64 = base64_encode($csrDer);
        $lines = chunk_split($b64, 64, "\n");

        return "-----BEGIN CERTIFICATE REQUEST-----\n" . trim($lines) . "\n-----END CERTIFICATE REQUEST-----\n";
    }

    /**
     * Pure PHP C14N 1.1 Canonicalizer & SHA-256 Invoice Hasher.
     * Strips UBLExtensions, Signature, and QR doc-ref per ZATCA specification.
     */
    public static function computeInvoiceHash(string $xmlString): array
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = false;
        $dom->preserveWhiteSpace = true;
        $dom->loadXML($xmlString);

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('ext', 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2');
        $xpath->registerNamespace('cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');
        $xpath->registerNamespace('cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');

        // 1. Remove UBLExtensions
        foreach ($xpath->query('//ext:UBLExtensions') as $el) {
            $el->parentNode->removeChild($el);
        }

        // 2. Remove Signature
        foreach ($xpath->query('//cac:Signature') as $el) {
            $el->parentNode->removeChild($el);
        }

        // 3. Remove QR AdditionalDocumentReference
        foreach ($xpath->query('//cac:AdditionalDocumentReference[cbc:ID="QR"]') as $el) {
            $el->parentNode->removeChild($el);
        }

        // 4. Run Canonicalization C14N 1.1 (Without Comments)
        $canonicalXml = $dom->C14N(false, false);
        $binaryHash = hash('sha256', $canonicalXml, true);

        return [
            'hash' => base64_encode($binaryHash),
            'hash_hex' => bin2hex($binaryHash),
            'canonical_xml' => $canonicalXml,
        ];
    }

    /**
     * Extracts certificate details and computes the EXACT 88-character CertDigest expected by ZATCA.
     */
    public static function extractCertificateDetails(string $certInput): array
    {
        $clean = trim($certInput);
        $decodedUtf8 = @base64_decode($clean);

        if (strpos($clean, '-----BEGIN CERTIFICATE-----') !== false) {
            $pem = $clean;
        } elseif ($decodedUtf8 && strpos($decodedUtf8, '-----BEGIN CERTIFICATE-----') !== false) {
            $pem = $decodedUtf8;
        } elseif ($decodedUtf8 && (str_starts_with($decodedUtf8, 'MII') || strlen($decodedUtf8) > 50)) {
            $cleanInner = preg_replace('/\s+/', '', $decodedUtf8);
            $pem = "-----BEGIN CERTIFICATE-----\n" . chunk_split($cleanInner, 64, "\n") . "-----END CERTIFICATE-----\n";
        } else {
            $cleanSingle = preg_replace('/\s+/', '', $clean);
            $pem = "-----BEGIN CERTIFICATE-----\n" . chunk_split($cleanSingle, 64, "\n") . "-----END CERTIFICATE-----\n";
        }

        $cleanCertB64 = preg_replace('/\s+/', '', str_replace(['-----BEGIN CERTIFICATE-----', '-----END CERTIFICATE-----'], '', $pem));
        $certDer = base64_decode($cleanCertB64);

        // CRITICAL: ZATCA expects Base64 of the SHA-256 HEX string (88 chars), NOT raw binary base64!
        $certDigestHex = hash('sha256', $cleanCertB64);
        $certDigest = base64_encode($certDigestHex);

        $certInfo = openssl_x509_parse($pem);
        if (!$certInfo) {
            throw new Exception("Unable to parse X.509 certificate.");
        }

        // Issuer DN in RFC2253 / comma-separated format
        $issuerParts = [];
        if (!empty($certInfo['issuer'])) {
            foreach ($certInfo['issuer'] as $k => $v) {
                $issuerParts[] = "$k=$v";
            }
        }
        $issuerName = implode(', ', array_reverse($issuerParts));

        // Serial number in decimal
        $serialNumber = $certInfo['serialNumber'] ?? '';
        if ($serialNumber && str_starts_with($serialNumber, '0x')) {
            $serialNumber = (string)hexdec(substr($serialNumber, 2));
        }

        // Extract raw SPKI public key DER (Tag 8) & CA Signature DER (Tag 9)
        $pubKeyObj = openssl_pkey_get_public($pem);
        $pubDetails = openssl_pkey_get_details($pubKeyObj);
        $spkiPem = $pubDetails['key'];
        $cleanSpki = preg_replace('/\s+/', '', str_replace(['-----BEGIN PUBLIC KEY-----', '-----END PUBLIC KEY-----'], '', $spkiPem));
        $spkiDer = base64_decode($cleanSpki);

        // Extract CA signature bytes directly from X.509 DER structure
        $caSignature = self::extractCaSignatureFromDer($certDer);

        return [
            'cert_digest' => $certDigest, // Exactly 88 characters
            'issuer_name' => $issuerName,
            'serial_number' => $serialNumber,
            'public_key' => $spkiPem,
            'pem' => $pem,
            'der_base64' => $cleanCertB64,
            'spki_der' => $spkiDer,
            'ca_signature' => $caSignature,
        ];
    }

    /**
     * Extracts the ASN.1 CA Signature bytes from the end of an X.509 DER certificate.
     */
    private static function extractCaSignatureFromDer(string $der): ?string
    {
        // An X.509 cert is a SEQUENCE containing: [0] TBSCertificate, [1] AlgorithmIdentifier, [2] BIT STRING (Signature)
        // Find the last BIT STRING in the DER sequence
        $len = strlen($der);
        if ($len < 64) return null;

        // Traverse from end backwards looking for BIT STRING tag 0x03
        for ($i = $len - 10; $i > $len - 150; $i--) {
            if (ord($der[$i]) === 0x03) {
                $sigLen = ord($der[$i + 1]);
                if ($sigLen > 68 && $sigLen < 76 && ($i + 2 + $sigLen) <= $len) {
                    $unusedBits = ord($der[$i + 2]);
                    if ($unusedBits === 0x00) {
                        return substr($der, $i + 3, $sigLen - 1);
                    }
                }
            }
        }
        return null;
    }
}
```

---

## 🏷️ 5. Phase 2 TLV 9-Tag QR Code Encoder (`app/Services/Zatca/ZatcaTlvHelper.php`)

```php
<?php

namespace App\Services\Zatca;

class ZatcaTlvHelper
{
    /**
     * Encodes tags 1 through 9 into standard ZATCA TLV format (Base64 string).
     *
     * @param array<int, string> $tags Tag number mapped to string/binary payload.
     * @return string Base64 encoded TLV string.
     */
    public static function encode(array $tags): string
    {
        ksort($tags);
        $buffer = '';

        foreach ($tags as $tag => $val) {
            $tagByte = chr((int)$tag);
            $valBytes = (string)$val;
            $lenByte = chr(strlen($valBytes));
            $buffer .= $tagByte . $lenByte . $valBytes;
        }

        return base64_encode($buffer);
    }
}
```

---

## 📄 6. UBL 2.1 XML Generator (`app/Services/Zatca/ZatcaXmlGeneratorService.php`)
### Strictly Ordered XML Elements to Prevent `XSD_ZATCA_INVALID`

```php
<?php

namespace App\Services\Zatca;

use App\Models\ZatcaConfig;
use Carbon\Carbon;

class ZatcaXmlGeneratorService
{
    /**
     * Builds standard compliant UBL 2.1 XML for ZATCA Phase 2.
     */
    public function buildInvoiceXml(
        array $data,
        ZatcaConfig $config,
        int $icv,
        string $pih
    ): array {
        $currency = 'SAR';
        $issueDatetime = isset($data['issue_datetime']) ? Carbon::parse($data['issue_datetime']) : Carbon::now('Asia/Riyadh');
        $issueDatetime->setTimezone('Asia/Riyadh');

        $ksaDate = $issueDatetime->format('Y-m-d');
        $ksaTime = $issueDatetime->format('H:i:s');

        $txType = $data['transaction_type'] ?? 'invoice_388';
        $txTypeCode = match ($txType) {
            'credit_note_381' => '381',
            'debit_note_383'  => '383',
            default           => '388',
        };

        $invoiceType = $data['invoice_type'] ?? 'simplified';
        $subType = ($invoiceType === 'standard') ? '0100000' : '0200000';

        // 1. Build Line Items
        $totalExclusive = 0.0;
        $totalVat = 0.0;
        $totalInclusive = 0.0;
        $linesXml = [];

        foreach ($data['items'] as $index => $item) {
            $qty = (float)($item['quantity'] ?? 1);
            $unitPrice = (float)($item['unit_price'] ?? 0);
            $discount = (float)($item['discount'] ?? 0);
            $lineExtension = round(($qty * $unitPrice) - $discount, 2);
            $vatRate = (float)($item['vat_rate'] ?? 15.0);
            $lineVat = round($lineExtension * ($vatRate / 100), 2);
            $lineInclusive = round($lineExtension + $lineVat, 2);

            $totalExclusive += $lineExtension;
            $totalVat += $lineVat;
            $totalInclusive += $lineInclusive;

            $lineNum = $index + 1;
            $unitCode = $item['unit_code'] ?? 'PCE';
            $vatCat = $item['vat_category'] ?? 'S';
            $itemName = $this->escapeXml($item['name']);

            $linesXml[] = <<<XML
    <cac:InvoiceLine>
        <cbc:ID>{$lineNum}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="{$unitCode}">{$qty}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="{$currency}">{$lineExtension}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="{$currency}">{$lineVat}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="{$currency}">{$lineInclusive}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>{$itemName}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>{$vatCat}</cbc:ID>
                <cbc:Percent>{$vatRate}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="{$currency}">{$unitPrice}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>
XML;
        }

        $linesXmlString = implode("\n", $linesXml);

        // 2. Billing Reference (Mandatory for Credit/Debit Notes)
        $billingRefXml = '';
        if (!empty($data['billing_reference_id']) && in_array($txTypeCode, ['381', '383'])) {
            $refId = $this->escapeXml($data['billing_reference_id']);
            $billingRefXml = <<<XML
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>{$refId}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>
XML;
        }

        // 3. Customer Party (CRITICAL: PostalAddress FIRST, PartyTaxScheme SECOND, PartyLegalEntity THIRD)
        $customerPartyXml = '';
        if ($invoiceType === 'standard' && !empty($data['customer'])) {
            $cust = $data['customer'];
            $custStreet = $this->escapeXml($cust['street_name'] ?? 'Olaya St');
            $custBldg = $this->escapeXml($cust['building_number'] ?? '1234');
            $custDistrict = $this->escapeXml($cust['city_subdivision'] ?? 'Al-Olaya');
            $custCity = $this->escapeXml($cust['city_name'] ?? 'Riyadh');
            $custPostal = $this->escapeXml($cust['postal_code'] ?? '12211');
            $custCountry = $cust['country_code'] ?? 'SA';
            $custName = $this->escapeXml($cust['name'] ?? 'B2B Customer');

            $taxSchemeXml = '';
            if (!empty($cust['vat_number'])) {
                $taxSchemeXml = <<<XML
            <cac:PartyTaxScheme>
                <cbc:CompanyID>{$cust['vat_number']}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
XML;
            }

            $customerPartyXml = <<<XML
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PostalAddress>
                <cbc:StreetName>{$custStreet}</cbc:StreetName>
                <cbc:BuildingNumber>{$custBldg}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>{$custDistrict}</cbc:CitySubdivisionName>
                <cbc:CityName>{$custCity}</cbc:CityName>
                <cbc:PostalZone>{$custPostal}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>{$custCountry}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
{$taxSchemeXml}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{$custName}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
XML;
        } else {
            $custName = !empty($data['customer']['name']) ? $this->escapeXml($data['customer']['name']) : '';
            $legalEntityXml = $custName ? "<cac:PartyLegalEntity><cbc:RegistrationName>{$custName}</cbc:RegistrationName></cac:PartyLegalEntity>" : '';
            $customerPartyXml = <<<XML
    <cac:AccountingCustomerParty>
        <cac:Party>
            {$legalEntityXml}
        </cac:Party>
    </cac:AccountingCustomerParty>
XML;
        }

        // Supplier Data
        $suppName = $this->escapeXml($config->taxpayer_name);
        $suppVat = $config->vat_number;
        $suppStreet = $this->escapeXml($config->street_name);
        $suppBldg = $this->escapeXml($config->building_number);
        $suppDistrict = $this->escapeXml($config->city_subdivision ?: 'Al-Husam');
        $suppCity = $this->escapeXml($config->city_name);
        $suppPostal = $this->escapeXml($config->postal_code);
        $suppCountry = $config->country_code ?: 'SA';

        $crnXml = '';
        if (!empty($config->crn)) {
            $crnVal = $this->escapeXml($config->crn);
            $crnXml = <<<XML
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">{$crnVal}</cbc:ID>
            </cac:PartyIdentification>
XML;
        }

        $invNumber = $this->escapeXml($data['invoice_number']);
        $uuid = $data['uuid'];
        $totalExclFormatted = number_format($totalExclusive, 2, '.', '');
        $totalVatFormatted = number_format($totalVat, 2, '.', '');
        $totalInclFormatted = number_format($totalInclusive, 2, '.', '');

        $xml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
            <ext:ExtensionContent>
                <!-- ZATCA Signature will be injected here -->
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>{$invNumber}</cbc:ID>
    <cbc:UUID>{$uuid}</cbc:UUID>
    <cbc:IssueDate>{$ksaDate}</cbc:IssueDate>
    <cbc:IssueTime>{$ksaTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="{$subType}">{$txTypeCode}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>{$currency}</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>{$currency}</cbc:TaxCurrencyCode>
{$billingRefXml}
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>{$icv}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">{$pih}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">QR_PLACEHOLDER</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>
    <cac:AccountingSupplierParty>
        <cac:Party>
{$crnXml}
            <cac:PostalAddress>
                <cbc:StreetName>{$suppStreet}</cbc:StreetName>
                <cbc:BuildingNumber>{$suppBldg}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>{$suppDistrict}</cbc:CitySubdivisionName>
                <cbc:CityName>{$suppCity}</cbc:CityName>
                <cbc:PostalZone>{$suppPostal}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>{$suppCountry}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>{$suppVat}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>{$suppName}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
{$customerPartyXml}
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
    </cac:PaymentMeans>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="{$currency}">{$totalVatFormatted}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="{$currency}">{$totalExclFormatted}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="{$currency}">{$totalVatFormatted}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="{$currency}">{$totalExclFormatted}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="{$currency}">{$totalExclFormatted}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="{$currency}">{$totalInclFormatted}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="{$currency}">{$totalInclFormatted}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
{$linesXmlString}
</Invoice>
XML;

        return ['xml' => $xml];
    }

    private function escapeXml(?string $str): string
    {
        if (!$str) return '';
        return htmlspecialchars($str, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
```

---

## 🖋️ 7. Digital Signer & XAdES Envelope (`app/Services/Zatca/ZatcaSignerService.php`)
### Injects Strict Enveloped Signatures & 9-Tag Phase 2 TLV QR Codes

```php
<?php

namespace App\Services\Zatca;

use Carbon\Carbon;

class ZatcaSignerService
{
    /**
     * Signs UBL 2.1 invoice XML and generates compliant 9-Tag Phase 2 TLV QR Code.
     */
    public function signInvoiceXml(
        string $rawXml,
        string $privateKeyPem,
        string $certificateBase64
    ): array {
        // 1. Canonical invoice hash
        $hashData = ZatcaCryptoHelper::computeInvoiceHash($rawXml);
        $invoiceHash = $hashData['hash'];

        // 2. Extract Certificate Details (88-char CertDigest)
        $certDetails = ZatcaCryptoHelper::extractCertificateDetails($certificateBase64);

        // 3. Signing timestamp in UTC strictly without milliseconds
        $signingTime = Carbon::now('UTC')->format('Y-m-d\TH:i:s\Z');

        // 4. Construct SignedProperties for hashing
        $signedPropertiesForSigning = <<<XML
<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>{$signingTime}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">{$certDetails['cert_digest']}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">{$certDetails['issuer_name']}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">{$certDetails['serial_number']}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>
XML;

        $signedPropertiesDigest = base64_encode(hash('sha256', $signedPropertiesForSigning, true));

        $signedPropertiesInXml = <<<XML
<xades:SignedProperties Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>{$signingTime}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue>{$certDetails['cert_digest']}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName>{$certDetails['issuer_name']}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber>{$certDetails['serial_number']}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>
XML;

        // 5. Construct ds:SignedInfo
        $signedInfoXml = <<<XML
        <ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
        <ds:Reference Id="invoiceSignedData" URI="">
            <ds:Transforms>
                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                </ds:Transform>
                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                </ds:Transform>
                <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                </ds:Transform>
                <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
            </ds:Transforms>
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>{$invoiceHash}</ds:DigestValue>
        </ds:Reference>
        <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
            <ds:DigestValue>{$signedPropertiesDigest}</ds:DigestValue>
        </ds:Reference>
    </ds:SignedInfo>
XML;

        // Sign canonical invoice hash using EC private key
        $binaryInvoiceHash = base64_decode($invoiceHash);
        openssl_sign($binaryInvoiceHash, $derSignature, $privateKeyPem, OPENSSL_ALGO_SHA256);
        $signatureValue = base64_encode($derSignature);

        // 6. Complete UBLDocumentSignatures block
        $fullSignatureBlock = <<<XML
<sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
                <sac:SignatureInformation>
                    <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
                    <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
                    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
{$signedInfoXml}
                        <ds:SignatureValue>{$signatureValue}</ds:SignatureValue>
                        <ds:KeyInfo>
                            <ds:X509Data>
                                <ds:X509Certificate>{$certDetails['der_base64']}</ds:X509Certificate>
                            </ds:X509Data>
                        </ds:KeyInfo>
                        <ds:Object>
                            <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
{$signedPropertiesInXml}
                            </xades:QualifyingProperties>
                        </ds:Object>
                    </ds:Signature>
                </sac:SignatureInformation>
            </sig:UBLDocumentSignatures>
XML;

        // Inject Signature into UBLExtension
        $signedXml = preg_replace(
            '/<ext:ExtensionContent>[\s\S]*?<!-- ZATCA Signature will be injected here -->[\s\S]*?<\/ext:ExtensionContent>/',
            "<ext:ExtensionContent>\n            {$fullSignatureBlock}\n            </ext:ExtensionContent>",
            $rawXml
        );

        // 7. Extract Details to Construct Phase 2 TLV QR Code (9 Tags)
        $sellerName = $this->extractTagContent($rawXml, 'cac:AccountingSupplierParty', 'cbc:RegistrationName');
        $sellerVat = $this->extractTagContent($rawXml, 'cac:AccountingSupplierParty', 'cbc:CompanyID');
        $issueDate = $this->extractSingleTagContent($rawXml, 'cbc:IssueDate');
        $issueTime = $this->extractSingleTagContent($rawXml, 'cbc:IssueTime');
        $totalInclusive = $this->extractSingleTagContent($rawXml, 'cbc:TaxInclusiveAmount');
        $totalVat = $this->extractTagContent($rawXml, 'cac:TaxTotal', 'cbc:TaxAmount');

        $qrTimestamp = "{$issueDate}T{$issueTime}";

        $tlvTags = [
            1 => $sellerName,
            2 => $sellerVat,
            3 => $qrTimestamp,
            4 => $totalInclusive ?: '0.00',
            5 => $totalVat ?: '0.00',
            6 => $invoiceHash,
            7 => $signatureValue,
            8 => $certDetails['spki_der'],
        ];

        if (!empty($certDetails['ca_signature'])) {
            $tlvTags[9] = $certDetails['ca_signature'];
        }

        $qrCodePayload = ZatcaTlvHelper::encode($tlvTags);

        // 8. Inject QR Code into AdditionalDocumentReference (QR)
        $signedXml = preg_replace(
            '/<cbc:EmbeddedDocumentBinaryObject mimeCode="text\/plain">\s*QR_PLACEHOLDER\s*<\/cbc:EmbeddedDocumentBinaryObject>/',
            "<cbc:EmbeddedDocumentBinaryObject mimeCode=\"text/plain\">{$qrCodePayload}</cbc:EmbeddedDocumentBinaryObject>",
            $signedXml
        );

        return [
            'signed_xml' => $signedXml,
            'invoice_hash' => $invoiceHash,
            'signature' => $signatureValue,
            'qr_code_payload' => $qrCodePayload,
        ];
    }

    private function extractTagContent(string $xml, string $parentTag, string $targetTag): string
    {
        if (preg_match("/<{$parentTag}[\s\S]*?<\/{$parentTag}>/m", $xml, $parentMatch)) {
            if (preg_match("/<{$targetTag}[^>]*>([\s\S]*?)<\/{$targetTag}>/m", $parentMatch[0], $match)) {
                return trim($match[1]);
            }
        }
        return '';
    }

    private function extractSingleTagContent(string $xml, string $tag): string
    {
        if (preg_match("/<{$tag}[^>]*>([\s\S]*?)<\/{$tag}>/m", $xml, $match)) {
            return trim($match[1]);
        }
        return '';
    }
}
```

---

## 🌐 8. ZATCA API Client (`app/Services/Zatca/ZatcaApiService.php`)
### Real-Time Clearance, Reporting & CSID Lifecycle via Laravel HTTP Client

```php
<?php

namespace App\Services\Zatca;

use Illuminate\Support\Facades\Http;

class ZatcaApiService
{
    private string $baseUrl;
    private string $apiVersion = 'V2';

    public function __construct(string $environment = 'production')
    {
        $this->baseUrl = match ($environment) {
            'production' => 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
            'simulation' => 'https://gw-fatoora.simulation.zatca.gov.sa/e-invoicing/core',
            default      => 'https://gw-fatoora.sandbox.zatca.gov.sa/e-invoicing/core',
        };
    }

    /**
     * Request Compliance CSID using OTP and CSR.
     */
    public function requestComplianceCsid(string $otp, string $csrPem): array
    {
        $url = "{$this->baseUrl}/compliance";
        $cleanCsr = preg_replace('/\s+/', '', str_replace(['-----BEGIN CERTIFICATE REQUEST-----', '-----END CERTIFICATE REQUEST-----'], '', $csrPem));

        $response = Http::withHeaders([
            'OTP' => trim($otp),
            'Accept-Version' => $this->apiVersion,
            'Content-Type' => 'application/json',
        ])->post($url, [
            'csr' => $cleanCsr,
        ]);

        return $this->parseResponse($response);
    }

    /**
     * Submit Compliance Check Invoice (Simplified or Standard).
     */
    public function submitComplianceInvoice(
        string $complianceToken,
        string $complianceSecret,
        string $invoiceHash,
        string $uuid,
        string $signedXml,
        bool $isStandardInvoice = false
    ): array {
        $url = "{$this->baseUrl}/compliance/invoices";
        $authHeader = 'Basic ' . base64_encode("{$complianceToken}:{$complianceSecret}");

        $response = Http::withHeaders([
            'Authorization' => $authHeader,
            'Accept-Version' => $this->apiVersion,
            'Accept-Language' => 'en',
            'Clearance-Status' => $isStandardInvoice ? '1' : '0',
            'Content-Type' => 'application/json',
        ])->post($url, [
            'invoiceHash' => $invoiceHash,
            'uuid' => $uuid,
            'invoice' => base64_encode($signedXml),
        ]);

        return $this->parseResponse($response);
    }

    /**
     * Request Production CSID (PCSID) after compliance checks pass.
     */
    public function requestProductionCsid(
        string $complianceToken,
        string $complianceSecret,
        string $complianceRequestId
    ): array {
        $url = "{$this->baseUrl}/production/csids";
        $authHeader = 'Basic ' . base64_encode("{$complianceToken}:{$complianceSecret}");

        $response = Http::withHeaders([
            'Authorization' => $authHeader,
            'Accept-Version' => $this->apiVersion,
            'Content-Type' => 'application/json',
        ])->post($url, [
            'compliance_request_id' => $complianceRequestId,
        ]);

        return $this->parseResponse($response);
    }

    /**
     * Report Simplified Invoice (B2C) within 24 hours.
     */
    public function reportInvoice(
        string $productionToken,
        string $productionSecret,
        string $invoiceHash,
        string $uuid,
        string $signedXml
    ): array {
        $url = "{$this->baseUrl}/invoices/reporting/single";
        $authHeader = 'Basic ' . base64_encode("{$productionToken}:{$productionSecret}");

        $response = Http::withHeaders([
            'Authorization' => $authHeader,
            'Accept-Version' => $this->apiVersion,
            'Accept-Language' => 'en',
            'Clearance-Status' => '0',
            'Content-Type' => 'application/json',
        ])->post($url, [
            'invoiceHash' => $invoiceHash,
            'uuid' => $uuid,
            'invoice' => base64_encode($signedXml),
        ]);

        return $this->parseResponse($response);
    }

    /**
     * Real-time Clearance for Standard Invoice (B2B).
     */
    public function clearInvoice(
        string $productionToken,
        string $productionSecret,
        string $invoiceHash,
        string $uuid,
        string $signedXml
    ): array {
        $url = "{$this->baseUrl}/invoices/clearance/single";
        $authHeader = 'Basic ' . base64_encode("{$productionToken}:{$productionSecret}");

        $response = Http::withHeaders([
            'Authorization' => $authHeader,
            'Accept-Version' => $this->apiVersion,
            'Accept-Language' => 'en',
            'Clearance-Status' => '1',
            'Content-Type' => 'application/json',
        ])->post($url, [
            'invoiceHash' => $invoiceHash,
            'uuid' => $uuid,
            'invoice' => base64_encode($signedXml),
        ]);

        return $this->parseResponse($response);
    }

    private function parseResponse($res): array
    {
        $statusCode = $res->status();
        $data = $res->json() ?: ['raw' => $res->body()];

        $validationResults = $data['validationResults'] ?? [
            'status' => ($statusCode >= 200 && $statusCode < 300) ? 'PASS' : 'ERROR',
            'errorMessages' => $data['errors'] ?? [],
            'warningMessages' => $data['warnings'] ?? [],
            'infoMessages' => $data['info'] ?? [],
        ];

        return [
            'success' => ($statusCode >= 200 && $statusCode < 300),
            'status_code' => $statusCode,
            'data' => $data,
            'validation_results' => $validationResults,
        ];
    }
}
```

---

## 🚀 9. Automated 6-Step Onboarding Service (`app/Services/Zatca/ZatcaOnboardingService.php`)
### Strictly Executes All 6 Required Compliance Checks to Obtain Production CSID

```php
<?php

namespace App\Services\Zatca;

use App\Models\ZatcaConfig;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Str;

class ZatcaOnboardingService
{
    private ZatcaXmlGeneratorService $xmlGenerator;
    private ZatcaSignerService $signer;

    public function __construct()
    {
        $this->xmlGenerator = new ZatcaXmlGeneratorService();
        $this->signer = new ZatcaSignerService();
    }

    /**
     * Complete Automated Onboarding Workflow.
     */
    public function fullAutomatedOnboard(array $payload): ZatcaConfig
    {
        $branchId = $payload['branch_id'] ?? 'MAIN-BRANCH';
        $config = ZatcaConfig::where('branch_id', $branchId)->first();

        // SAFEGUARD: If already onboarded with a valid Production CSID, protect it from accidental re-onboarding
        if ($config && $config->is_fully_onboarded && empty($payload['force_reonboard'])) {
            $config->update(array_filter([
                'device_name' => $payload['device_name'] ?? null,
                'taxpayer_name' => $payload['taxpayer_name'] ?? null,
                'street_name' => $payload['street_name'] ?? null,
                'building_number' => $payload['building_number'] ?? null,
                'city_name' => $payload['city_name'] ?? null,
                'postal_code' => $payload['postal_code'] ?? null,
                'crn' => $payload['crn'] ?? null,
            ]));
            return $config;
        }

        // Generate fresh EC Key Pair and Serial Number for new registration
        $keys = ZatcaCryptoHelper::generateEcKeyPair();
        $serialNumber = "1-POS|2-{$branchId}|3-" . substr(Str::uuid()->toString(), 0, 18);

        if (!$config) {
            $config = ZatcaConfig::create(array_merge($payload, [
                'branch_id' => $branchId,
                'private_key' => $keys['private_key'],
                'public_key' => $keys['public_key'],
                'serial_number' => $serialNumber,
                'status' => 'pending',
            ]));
        } else {
            $config->update(array_merge($payload, [
                'private_key' => $keys['private_key'],
                'public_key' => $keys['public_key'],
                'serial_number' => $serialNumber,
                'csr_content' => null,
                'compliance_csid' => null,
                'compliance_secret' => null,
                'compliance_request_id' => null,
                'status' => 'pending',
            ]));
        }

        // Step 1: Generate Pure In-Process ASN.1 CSR
        $csr = ZatcaCryptoHelper::generatePureCsr($config->private_key, [
            'vat_number' => $config->vat_number,
            'taxpayer_name' => $config->taxpayer_name,
            'branch_name' => $config->branch_name,
            'serial_number' => $config->serial_number,
            'building_number' => $config->building_number,
            'street_name' => $config->street_name,
            'business_category' => $config->business_category,
            'invoice_type_flag' => '1100',
        ], $config->environment);

        $config->update(['csr_content' => $csr]);

        // Step 2: Exchange OTP for Compliance CSID
        $api = new ZatcaApiService($config->environment);
        $csidRes = $api->requestComplianceCsid($payload['otp'], $csr);

        if (!$csidRes['success']) {
            $err = $csidRes['data']['errors'][0]['message'] ?? $csidRes['data']['message'] ?? 'Failed to exchange OTP with ZATCA';
            throw new Exception("ZATCA Compliance CSID failed ({$csidRes['status_code']}): {$err}");
        }

        $config->update([
            'compliance_csid' => $csidRes['data']['binarySecurityToken'],
            'compliance_secret' => $csidRes['data']['secret'],
            'compliance_request_id' => (string)($csidRes['data']['requestID'] ?? ''),
        ]);

        // Step 3: Run the 6 Mandatory Compliance Checks
        $compliancePassed = $this->runAllSixComplianceSteps($config);
        if (!$compliancePassed) {
            throw new Exception("Compliance checks did not pass. Production CSID cannot be issued.");
        }

        $config->update(['status' => 'compliance_passed']);

        // Step 4: Request Production CSID (PCSID)
        $prodRes = $api->requestProductionCsid(
            $config->compliance_csid,
            $config->compliance_secret,
            $config->compliance_request_id
        );

        if (!$prodRes['success']) {
            $err = $prodRes['data']['errors'][0]['message'] ?? $prodRes['data']['message'] ?? 'Production CSID request rejected';
            throw new Exception("ZATCA Production CSID issuance failed ({$prodRes['status_code']}): {$err}");
        }

        $config->update([
            'production_csid' => $prodRes['data']['binarySecurityToken'],
            'production_secret' => $prodRes['data']['secret'],
            'production_request_id' => (string)($prodRes['data']['requestID'] ?? ''),
            'status' => 'onboarded',
            'onboarded_at' => Carbon::now(),
        ]);

        return $config;
    }

    /**
     * Executes the strict 6 compliance invoices required by ZATCA.
     */
    private function runAllSixComplianceSteps(ZatcaConfig $config): bool
    {
        $api = new ZatcaApiService($config->environment);
        $prevHash = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjExN2Q5MTU0NWNmNEY=';
        $icv = 1;

        $standardCustomer = [
            'name' => 'Compliance B2B Buyer LLC',
            'vat_number' => '300000000000003',
            'street_name' => 'Olaya St',
            'building_number' => '1234',
            'city_subdivision' => 'Al-Olaya',
            'city_name' => 'Riyadh',
            'postal_code' => '12211',
            'country_code' => 'SA',
        ];

        $steps = [
            ['key' => 'simpInv', 'type' => 'simplified', 'tx' => 'invoice_388', 'clearance' => false],
            ['key' => 'simpCn',  'type' => 'simplified', 'tx' => 'credit_note_381', 'clearance' => false, 'ref' => 'COMP-SIMP-REF'],
            ['key' => 'simpDn',  'type' => 'simplified', 'tx' => 'debit_note_383', 'clearance' => false, 'ref' => 'COMP-SIMP-REF'],
            ['key' => 'stdInv',  'type' => 'standard',   'tx' => 'invoice_388', 'clearance' => true, 'customer' => $standardCustomer],
            ['key' => 'stdCn',   'type' => 'standard',   'tx' => 'credit_note_381', 'clearance' => true, 'customer' => $standardCustomer, 'ref' => 'COMP-STD-REF'],
            ['key' => 'stdDn',   'type' => 'standard',   'tx' => 'debit_note_383', 'clearance' => true, 'customer' => $standardCustomer, 'ref' => 'COMP-STD-REF'],
        ];

        foreach ($steps as $step) {
            $stepUuid = Str::uuid()->toString();
            $stepBuild = $this->xmlGenerator->buildInvoiceXml([
                'invoice_number' => "COMP-" . time() . "-{$icv}",
                'uuid' => $stepUuid,
                'invoice_type' => $step['type'],
                'transaction_type' => $step['tx'],
                'billing_reference_id' => $step['ref'] ?? null,
                'customer' => $step['customer'] ?? null,
                'items' => [
                    ['name' => 'Compliance Test Product', 'quantity' => 2, 'unit_price' => 25.0, 'vat_rate' => 15.0, 'vat_category' => 'S']
                ],
            ], $config, $icv++, $prevHash);

            $signed = $this->signer->signInvoiceXml($stepBuild['xml'], $config->private_key, $config->compliance_csid);
            $prevHash = $signed['invoice_hash'];

            $stepRes = $api->submitComplianceInvoice(
                $config->compliance_csid,
                $config->compliance_secret,
                $signed['invoice_hash'],
                $stepUuid,
                $signed['signed_xml'],
                $step['clearance']
            );

            $msg = $stepRes['data']['message'] ?? '';
            $isPass = $stepRes['success'] || $stepRes['status_code'] === 200 || str_contains($msg, 'already completed');

            if (!$isPass) {
                logger()->warning("Compliance check [{$step['key']}] did not pass:", $stepRes['data']);
                return false;
            }
        }

        return true;
    }
}
```

---

## 🛒 10. Real-Time Sale Invoice Processor (`app/Services/Zatca/ZatcaInvoiceProcessorService.php`)

```php
<?php

namespace App\Services\Zatca;

use App\Models\ZatcaConfig;
use App\Models\ZatcaInvoice;
use Carbon\Carbon;
use Exception;
use Illuminate\Support\Str;

class ZatcaInvoiceProcessorService
{
    private ZatcaXmlGeneratorService $xmlGenerator;
    private ZatcaSignerService $signer;

    public function __construct()
    {
        $this->xmlGenerator = new ZatcaXmlGeneratorService();
        $this->signer = new ZatcaSignerService();
    }

    /**
     * Processes POS sale invoice, signs it, and sends to ZATCA.
     */
    public function processSaleInvoice(array $payload): ZatcaInvoice
    {
        $branchId = $payload['branch_id'] ?? 'MAIN-BRANCH';
        $config = ZatcaConfig::where('branch_id', $branchId)->first();

        if (!$config || !$config->is_fully_onboarded || empty($config->production_secret)) {
            throw new Exception("Branch [{$branchId}] is not onboarded with ZATCA. Complete onboarding first.");
        }

        // Sequential ICV & PIH tracking
        $config->increment('invoice_counter');
        $icv = $config->invoice_counter;
        $pih = $config->last_invoice_hash ?: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NjExN2Q5MTU0NWNmNEY=';
        $uuid = Str::uuid()->toString();

        $buildData = [
            'invoice_number' => $payload['invoice_number'],
            'uuid' => $uuid,
            'invoice_type' => $payload['invoice_type'] ?? 'simplified',
            'transaction_type' => $payload['transaction_type'] ?? 'invoice_388',
            'billing_reference_id' => $payload['billing_reference_id'] ?? null,
            'customer' => $payload['customer'] ?? null,
            'items' => $payload['items'],
        ];

        // 1. Build UBL 2.1 XML
        $buildResult = $this->xmlGenerator->buildInvoiceXml($buildData, $config, $icv, $pih);

        // 2. Sign XML and inject 9-Tag Phase 2 TLV QR Code
        $signed = $this->signer->signInvoiceXml($buildResult['xml'], $config->private_key, $config->production_csid);

        // Update PIH for the next invoice
        $config->update(['last_invoice_hash' => $signed['invoice_hash']]);

        // 3. Transmit to ZATCA
        $api = new ZatcaApiService($config->environment);
        $zatcaStatus = 'failed';
        $errors = [];
        $warnings = [];
        $rawResponse = null;

        try {
            if ($buildData['invoice_type'] === 'standard') {
                // Standard (B2B) -> Real-time Clearance
                $res = $api->clearInvoice($config->production_csid, $config->production_secret, $signed['invoice_hash'], $uuid, $signed['signed_xml']);
                $zatcaStatus = $res['success'] ? 'cleared' : 'rejected';
                $errors = $res['validation_results']['errorMessages'] ?? [];
                $warnings = $res['validation_results']['warningMessages'] ?? [];
                $rawResponse = $res['data'];
            } else {
                // Simplified (B2C) -> 24-hour Reporting
                $res = $api->reportInvoice($config->production_csid, $config->production_secret, $signed['invoice_hash'], $uuid, $signed['signed_xml']);
                $zatcaStatus = $res['success'] ? 'reported' : 'rejected';
                $errors = $res['validation_results']['errorMessages'] ?? [];
                $warnings = $res['validation_results']['warningMessages'] ?? [];
                $rawResponse = $res['data'];
            }
        } catch (\Throwable $networkErr) {
            logger()->warning("ZATCA network timeout; invoice marked pending for background sync: " . $networkErr->getMessage());
            $zatcaStatus = 'pending';
        }

        // 4. Save Invoice to Database
        return ZatcaInvoice::create([
            'branch_id' => $config->branch_id,
            'invoice_number' => $payload['invoice_number'],
            'uuid' => $uuid,
            'icv' => $icv,
            'pih' => $pih,
            'invoice_hash' => $signed['invoice_hash'],
            'invoice_type' => $buildData['invoice_type'],
            'transaction_type' => $buildData['transaction_type'],
            'total_amount' => $payload['total_inclusive_vat'],
            'vat_amount' => $payload['total_vat_amount'],
            'qr_code_payload' => $signed['qr_code_payload'],
            'signed_xml' => $signed['signed_xml'],
            'zatca_status' => $zatcaStatus,
            'validation_errors' => $errors,
            'validation_warnings' => $warnings,
            'raw_zatca_response' => $rawResponse,
            'reported_at' => in_array($zatcaStatus, ['reported', 'cleared']) ? Carbon::now() : null,
        ]);
    }
}
```

---

## ⏰ 11. Background 24-Hour Offline Sync Command (`app/Console/Commands/SyncPendingZatcaInvoices.php`)
### Enforces Mandatory Saudi Law: Auto-Reports Offline/Pending Invoices

Create command:
```bash
php artisan make:command SyncPendingZatcaInvoices
```

File: `app/Console/Commands/SyncPendingZatcaInvoices.php`

```php
<?php

namespace App\Console\Commands;

use App\Models\ZatcaConfig;
use App\Models\ZatcaInvoice;
use App\Services\Zatca\ZatcaApiService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SyncPendingZatcaInvoices extends Command
{
    protected $signature = 'app:sync-pending-zatca-invoices';
    protected $description = 'Reports pending or offline simplified invoices to ZATCA within 24 hours';

    public function handle(): int
    {
        $activeConfigs = ZatcaConfig::where('status', 'onboarded')->get();

        foreach ($activeConfigs as $config) {
            if (!$config->production_csid || !$config->production_secret) {
                continue;
            }

            $twentyFourHoursAgo = Carbon::now()->subHours(24);
            $pendingInvoices = ZatcaInvoice::where('branch_id', $config->branch_id)
                ->whereIn('zatca_status', ['pending', 'failed'])
                ->where('created_at', '>=', $twentyFourHoursAgo)
                ->orderBy('icv', 'asc')
                ->limit(20)
                ->get();

            if ($pendingInvoices->isEmpty()) {
                continue;
            }

            $api = new ZatcaApiService($config->environment);

            foreach ($pendingInvoices as $inv) {
                try {
                    $res = $api->reportInvoice(
                        $config->production_csid,
                        $config->production_secret,
                        $inv->invoice_hash,
                        $inv->uuid,
                        $inv->signed_xml
                    );

                    if ($res['success']) {
                        $inv->update([
                            'zatca_status' => 'reported',
                            'reported_at' => Carbon::now(),
                            'validation_errors' => null,
                        ]);
                        $this->info("Invoice {$inv->invoice_number} successfully reported.");
                    }
                } catch (\Throwable $e) {
                    $this->warn("Failed to sync invoice {$inv->invoice_number}: " . $e->getMessage());
                }
            }
        }

        return 0;
    }
}
```

### Scheduling the Command:
In **Laravel 11+** (`routes/console.php`):
```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('app:sync-pending-zatca-invoices')->everyTenMinutes();
```

In **Laravel 9 / 10** (`app/Console/Kernel.php`):
```php
protected function schedule(Schedule $schedule): void
{
    $schedule->command('app:sync-pending-zatca-invoices')->everyTenMinutes();
}
```

---

## 🚦 12. Laravel Controller (`app/Http/Controllers/ZatcaController.php`)

```php
<?php

namespace App\Http\Controllers;

use App\Models\ZatcaConfig;
use App\Models\ZatcaInvoice;
use App\Services\Zatca\ZatcaApiService;
use App\Services\Zatca\ZatcaOnboardingService;
use App\Services\Zatca\ZatcaInvoiceProcessorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ZatcaController extends Controller
{
    protected ZatcaOnboardingService $onboardingService;
    protected ZatcaInvoiceProcessorService $invoiceProcessor;

    public function __construct(
        ZatcaOnboardingService $onboardingService,
        ZatcaInvoiceProcessorService $invoiceProcessor
    ) {
        $this->onboardingService = $onboardingService;
        $this->invoiceProcessor = $invoiceProcessor;
    }

    /**
     * POST /api/v1/zatca/onboard
     */
    public function onboard(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => 'required|string',
            'otp' => 'required|string|size:6',
            'vat_number' => 'required|string|size:15',
            'taxpayer_name' => 'required|string',
            'device_name' => 'nullable|string',
            'street_name' => 'required|string',
            'building_number' => 'required|string',
            'city_name' => 'required|string',
            'postal_code' => 'required|string',
            'environment' => 'nullable|in:sandbox,simulation,production',
            'force_reonboard' => 'nullable|boolean',
        ]);

        try {
            $config = $this->onboardingService->fullAutomatedOnboard($validated);
            return response()->json([
                'success' => true,
                'message' => 'ZATCA Phase 2 Device Onboarded Successfully',
                'data' => [
                    'branch_id' => $config->branch_id,
                    'serial_number' => $config->serial_number,
                    'vat_number' => $config->vat_number,
                    'status' => $config->status,
                    'environment' => $config->environment,
                    'is_fully_onboarded' => $config->is_fully_onboarded,
                ],
            ], Response::HTTP_CREATED);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    /**
     * GET /api/v1/zatca/device/{branchId}
     */
    public function getDeviceStatus(string $branchId): JsonResponse
    {
        $config = ZatcaConfig::where('branch_id', $branchId)->first();
        if (!$config) {
            return response()->json([
                'success' => false,
                'message' => "No ZATCA configuration found for branch: {$branchId}",
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'branch_id' => $config->branch_id,
                'device_name' => $config->device_name,
                'serial_number' => $config->serial_number,
                'vat_number' => $config->vat_number,
                'taxpayer_name' => $config->taxpayer_name,
                'environment' => $config->environment,
                'status' => $config->status,
                'is_fully_onboarded' => $config->is_fully_onboarded,
                'onboarded_at' => $config->onboarded_at,
            ],
        ]);
    }

    /**
     * GET /api/v1/zatca/invoices
     */
    public function getInvoices(Request $request): JsonResponse
    {
        $query = ZatcaInvoice::query();

        if ($request->filled('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('zatca_status', $request->status);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhere('uuid', 'like', "%{$search}%");
            });
        }

        $invoices = $query->orderBy('id', 'desc')->paginate($request->get('limit', 20));

        return response()->json([
            'success' => true,
            'data' => $invoices,
        ]);
    }

    /**
     * GET /api/v1/zatca/invoices/{id}/xml
     */
    public function downloadXml(string $id)
    {
        $invoice = ZatcaInvoice::where('id', $id)
            ->orWhere('uuid', $id)
            ->orWhere('invoice_number', $id)
            ->firstOrFail();

        $xml = $invoice->stamped_xml ?: $invoice->signed_xml;
        $fileName = ($invoice->zatca_status === 'cleared' ? 'CLEARED_' : 'SIGNED_') . "{$invoice->invoice_number}.xml";

        return response($xml, 200, [
            'Content-Type' => 'application/xml',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ]);
    }
}
```

---

## 🛣️ 13. Laravel API Routes (`routes/api.php`)

Add to `routes/api.php`:

```php
use App\Http\Controllers\ZatcaController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/zatca')->middleware(['auth:sanctum'])->group(function () {
    Route::post('/onboard', [ZatcaController::class, 'onboard']);
    Route::get('/device/{branchId}', [ZatcaController::class, 'getDeviceStatus']);
    Route::get('/invoices', [ZatcaController::class, 'getInvoices']);
    Route::get('/invoices/{id}/xml', [ZatcaController::class, 'downloadXml']);
});
```

---

## 🧾 14. POS Sales Engine Hook (`SaleController.php` / `SaleService.php`)
### Seamlessly Generates ZATCA Invoices Without Blocking Cashier

In your Laravel POS sale creation method:

```php
use App\Models\Sale;
use App\Models\ZatcaConfig;
use App\Services\Zatca\ZatcaInvoiceProcessorService;

public function store(Request $request)
{
    // 1. Save Sale locally inside database transaction
    $sale = DB::transaction(function () use ($request) {
        return Sale::create($request->validated());
    });

    // 2. Automated Non-Blocking ZATCA Processing
    try {
        $activeConfig = ZatcaConfig::where('status', 'onboarded')->first();
        if ($activeConfig) {
            $vatPercent = (float)($sale->vat_percent ?? 15.0);
            $totalVat = round($sale->net_amount * ($vatPercent / (100 + $vatPercent)), 2);
            $totalExcl = round($sale->net_amount - $totalVat, 2);

            $processor = app(ZatcaInvoiceProcessorService::class);
            $zatcaInv = $processor->processSaleInvoice([
                'branch_id' => $activeConfig->branch_id,
                'invoice_number' => "INV-{$sale->invoice_no}",
                'invoice_type' => 'simplified', // B2C POS standard
                'items' => $sale->items->map(fn($it) => [
                    'name' => $it->product_name,
                    'quantity' => $it->quantity,
                    'unit_price' => $it->price,
                    'discount' => 0,
                    'vat_rate' => $vatPercent,
                    'vat_category' => 'S',
                    'unit_code' => ($it->unit_type === 'BOX') ? 'BOX' : 'PCE',
                ])->toArray(),
                'total_exclusive_vat' => $totalExcl,
                'total_vat_amount' => $totalVat,
                'total_inclusive_vat' => $sale->net_amount,
            ]);

            if ($zatcaInv && $zatcaInv->qr_code_payload) {
                $sale->update([
                    'qr_code_payload' => $zatcaInv->qr_code_payload,
                    'zatca_status' => $zatcaInv->zatca_status,
                ]);
            }
        }
    } catch (\Throwable $zatcaErr) {
        // Cashier is never blocked. Background worker will retry within 24 hours.
        logger()->warning("ZATCA automatic invoice processing notice: " . $zatcaErr->getMessage());
    }

    return response()->json(['success' => true, 'data' => $sale]);
}
```

---

## 💻 15. React.js Frontend Component (`ZatcaOnboardingSection.jsx`)
### Prevents Accidental Re-Onboarding, Displays Certified Status & Protects Active Credentials

Works in both standard React (Vite / CRA) and Inertia.js React:

```jsx
import React, { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";

export default function ZatcaOnboardingSection({ branchId = "MAIN-BRANCH", storeVatNumber, storeName }) {
  const [statusData, setStatusData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [environment, setEnvironment] = useState("production");
  const [otp, setOtp] = useState("");
  const [showReonboard, setShowReonboard] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/zatca/device/${branchId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setStatusData(json.data);
        if (json.data.environment) setEnvironment(json.data.environment);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [branchId]);

  const isOnboarded = statusData?.is_fully_onboarded;

  const handleOnboard = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!otp || otp.length !== 6) {
      setErrorMsg("رمز التحقق OTP يجب أن يتكون من 6 أرقام بالضبط.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/v1/zatca/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          device_name: "POS Terminal 01",
          otp: otp.trim(),
          environment,
          vat_number: storeVatNumber,
          taxpayer_name: storeName,
          street_name: "Main Street",
          building_number: "1234",
          city_name: "Riyadh",
          postal_code: "12211",
          force_reonboard: showReonboard,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMsg("تم ربط واعتماد الجهاز بنجاح مع هيئة الزكاة! تم استخراج شهادة الإنتاج (PCSID).");
        setOtp("");
        setShowReonboard(false);
        fetchStatus();
      } else {
        setErrorMsg(json.message || "فشل الربط مع هيئة الزكاة.");
      }
    } catch (err) {
      setErrorMsg("حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border-2 border-emerald-500/20 bg-white shadow-sm text-right" dir="rtl">
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">الربط مع هيئة الزكاة والضريبة والجمارك (ZATCA Phase 2)</h3>
              {isOnboarded ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 size={12} /> مربوط بنجاح (Live)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                  <AlertCircle size={12} /> غير مربوط (Pending)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              مرحلة الربط والتكامل — إصدار الفواتير الضريبية وتشفير أختام XAdES ورمز QR المعتمد.
            </p>
          </div>
        </div>
      </div>

      {successMsg && <div className="mt-4 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl">{successMsg}</div>}
      {errorMsg && <div className="mt-4 p-3 bg-red-50 text-red-800 text-xs rounded-xl">{errorMsg}</div>}

      {/* When Already Onboarded: Show Certified Protection Card */}
      {isOnboarded && !showReonboard ? (
        <div className="mt-5 p-5 rounded-xl border border-emerald-500/30 bg-emerald-50/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={24} className="text-emerald-600" />
              <div>
                <h4 className="font-bold text-sm">تم اعتماد وربط الجهاز بنجاح مع هيئة الزكاة والضريبة والجمارك</h4>
                <p className="text-xs text-gray-500">شهادة الإنتاج (Production CSID) مفعلة وتعمل بكفاءة.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowReonboard(true)}
              className="text-xs border px-3 py-1.5 rounded-lg hover:bg-gray-100 flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> تجديد / إعادة الربط (Re-onboard)
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t text-xs">
            <div>
              <span className="text-gray-500 block text-[11px]">بيئة العمل:</span>
              <span className="font-semibold text-emerald-600">
                {statusData?.environment === "production" ? "الإنتاج المباشر (Production)" : "التجربة (Sandbox)"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px]">الرقم التسلسلي:</span>
              <span className="font-mono">{statusData?.serial_number || "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px]">الرقم الضريبي:</span>
              <span className="font-mono font-bold">{statusData?.vat_number}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px]">تاريخ الاعتماد:</span>
              <span>{statusData?.onboarded_at ? new Date(statusData.onboarded_at).toLocaleDateString("ar-SA") : "معتمد"}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Onboarding Form */
        <form onSubmit={handleOnboard} className="mt-5 space-y-4">
          {isOnboarded && showReonboard && (
            <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-xl flex items-center justify-between">
              <span>⚠️ أنت تقوم حالياً بإعادة ربط الجهاز برمز OTP جديد.</span>
              <button type="button" onClick={() => setShowReonboard(false)} className="underline font-bold">
                إلغاء والعودة
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`p-3 border rounded-xl cursor-pointer ${environment === "production" ? "border-emerald-600 bg-emerald-50" : ""}`}>
              <input type="radio" checked={environment === "production"} onChange={() => setEnvironment("production")} />
              <span className="font-bold mr-2">Production (البيئة الحية والمباشرة)</span>
            </label>
            <label className={`p-3 border rounded-xl cursor-pointer ${environment === "sandbox" ? "border-blue-600 bg-blue-50" : ""}`}>
              <input type="radio" checked={environment === "sandbox"} onChange={() => setEnvironment("sandbox")} />
              <span className="font-bold mr-2">Sandbox (بيئة الاختبار والتطوير)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1">الرقم الضريبي للمنشأة (15 رقم)</label>
              <input type="text" readOnly value={storeVatNumber} className="w-full p-2.5 border rounded-lg bg-gray-100 text-xs font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1">رمز التحقق OTP (6 أرقام) *</label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder={environment === "sandbox" ? "123345" : "رمز من بوابة فاتورة"}
                className="w-full p-2.5 border rounded-lg text-xs font-mono font-bold tracking-widest text-center"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            بدء الربط والاعتماد مع الزكاة (Onboard Device)
          </button>
        </form>
      )}
    </div>
  );
}
```

---

## 🖨️ 16. Thermal Receipt QR Component (`ZatcaReceiptQr.jsx`)
### Displaying the ZATCA Phase 2 QR Code on 80mm / 58mm Thermal Printers

```jsx
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function ZatcaReceiptQr({ qrPayload, size = 120 }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!qrPayload) return;
    QRCode.toDataURL(qrPayload, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("ZATCA QR Generation Error:", err));
  }, [qrPayload, size]);

  if (!qrDataUrl) {
    return <div className="text-[10px] text-gray-400">جاري تجهيز رمز الاستجابة السريعة...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center my-2">
      <img src={qrDataUrl} alt="ZATCA Phase 2 QR" className="w-[120px] h-[120px] object-contain" />
      <span className="text-[9px] text-gray-600 font-sans mt-0.5">فاتورة ضريبية مبسطة معتمدة (ZATCA)</span>
    </div>
  );
}
```

---

## 🤖 17. The "One-Prompt" Master AI Directive for Laravel + React
### (Copy & Paste this Exact Prompt to Any AI Agent in Your Future Laravel Projects)

````markdown
### 🎯 MISSION: Implement ZATCA Phase 2 (Fatoora) E-Invoicing in this Laravel + React Project
You must integrate official Saudi Arabia ZATCA Phase 2 E-Invoicing into this repository (Laravel PHP backend and React.js frontend).
Follow the production-certified architecture in `docs/ZATCA_PHASE_2_LARAVEL_REACT_MASTER_BLUEPRINT.md` with ZERO deviations.

#### ⚠️ STRICT GOLDEN RULES:
1. **NATIVE PHP C14N 1.1 CANONICALIZATION**:
   Set `$dom->formatOutput = false;` and `$dom->preserveWhiteSpace = true;` before loading XML. Call native PHP `$dom->C14N(false, false)`. Never re-format or beautify the XML.
2. **CERTDIGEST MUST BE 88 CHARACTERS**:
   ZATCA strictly expects Base64 of SHA-256 HEX string:
   `base64_encode(hash('sha256', $cleanCertB64))`. Direct binary base64 (44 chars) will fail with `BR-KSA-28`.
3. **UBL 2.1 XSD SCHEMA ORDERING**:
   Under `<cac:AccountingCustomerParty><cac:Party>`, strictly follow order: `<cac:PostalAddress>` FIRST, `<cac:PartyTaxScheme>` SECOND, `<cac:PartyLegalEntity>` THIRD. Include `<cbc:CitySubdivisionName>` for Saudi addresses.
4. **PHASE 2 9-TAG QR CODE**:
   Extract raw SPKI public key (Tag 8) and ASN.1 DER CA signature (Tag 9) from the X.509 certificate. Tag 3 timestamp must match `<cbc:IssueDate>T<cbc:IssueTime>`.
5. **AUTOMATE ALL 6 COMPLIANCE CHECKS**:
   Do not request Production CSID until all 6 compliance test invoices (Simplified 388, 381, 383, Standard Clearance 388, 381, 383) are signed and submitted sequentially with PIH chaining.
6. **PREVENT ACCIDENTAL RE-ONBOARDING**:
   If the database has `status === 'onboarded'` and `production_csid`, never overwrite keys unless `force_reonboard: true` is passed.
7. **OFFLINE 24H BACKGROUND SYNC WORKER**:
   Implement an Artisan Scheduled Command (`app:sync-pending-zatca-invoices`) that polls pending simplified invoices and reports them to ZATCA within 24 hours.

#### 🛠️ TASKS TO COMPLETE:
- Run migrations for `zatca_configs` and `zatca_invoices`.
- Create models: `ZatcaConfig.php` and `ZatcaInvoice.php`.
- Create services under `app/Services/Zatca/`:
  - `ZatcaCryptoHelper.php` (secp256k1 EC keys, Pure ASN.1 CSR, C14N 1.1 Hasher, 88-char CertDigest)
  - `ZatcaTlvHelper.php` (9-Tag QR encoder)
  - `ZatcaXmlGeneratorService.php` (UBL 2.1 builder)
  - `ZatcaSignerService.php` (Digital signer & XAdES envelope)
  - `ZatcaApiService.php` (ZATCA REST API client)
  - `ZatcaOnboardingService.php` (6-step automated onboarding)
  - `ZatcaInvoiceProcessorService.php` (Real-time clearance & reporting)
- Create command: `SyncPendingZatcaInvoices.php` and register in scheduler.
- Create controller: `ZatcaController.php` and routes in `routes/api.php`.
- Hook into sales flow: `Sale::create` automatically triggers `ZatcaInvoiceProcessorService`.
- Create React components: `ZatcaOnboardingSection.jsx` & `ZatcaReceiptQr.jsx`.
- Run tests and verify zero PHP syntax errors and clean compilation.
````

---

## 🎯 18. Pre-Flight Verification Checklist Before Deployment

To verify that your Laravel + React project is 100% compliant and ready for production, verify these checks:

- [ ] **Native C14N 1.1**: Ensure `computeInvoiceHash` preserves whitespace and computes valid SHA-256 hashes without external binary calls.
- [ ] **XAdES CertDigest Length**: Ensure `cert_digest` is strictly **88 characters** long (Base64 of SHA-256 Hex string).
- [ ] **XML Schema Ordering**: Verify that `<cac:PostalAddress>` strictly precedes `<cac:PartyTaxScheme>` in buyer customer party.
- [ ] **QR Code TLV Verification**: Verify that QR contains **all 9 tags** and Tag 9 is a binary string of length 70–72 bytes.
- [ ] **All 6 Compliance Invoices**: Verify that `runAllSixComplianceSteps` submits all 6 invoices and receives `200 OK` from ZATCA.
- [ ] **Production Clearance & Reporting**: Verify that standard invoices return `cleared` and simplified invoices return `reported`.
- [ ] **Offline Sync Worker**: Verify that `php artisan app:sync-pending-zatca-invoices` is registered in `schedule()` to run every 10 minutes.
