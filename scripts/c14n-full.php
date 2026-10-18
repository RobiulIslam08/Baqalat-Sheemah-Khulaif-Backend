<?php
/**
 * Fast C14N 1.1 Canonicalizer and Hasher for ZATCA Phase 2.
 * Usage: php c14n-full.php <action>
 * action:
 *   - invoice-hash: Input raw invoice XML, removes UBLExtensions, cac:Signature, QR doc ref, returns JSON { hash, canonical }
 *   - c14n: Input any XML node string, returns C14N(false, false) string
 */
$action = $argv[1] ?? 'invoice-hash';
$input = file_get_contents('php://stdin');
if (empty($input)) {
    echo json_encode(['error' => 'Empty input']);
    exit(1);
}

libxml_disable_entity_loader(true);

if ($action === 'invoice-hash') {
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = false;
    $dom->preserveWhiteSpace = true;
    $dom->loadXML($input);

    $xpath = new DOMXPath($dom);
    $xpath->registerNamespace('ext', 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2');
    $xpath->registerNamespace('cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');
    $xpath->registerNamespace('cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');

    // 1. Remove UBL Extensions
    foreach ($xpath->query('//ext:UBLExtensions') as $el) {
        $el->parentNode->removeChild($el);
    }

    // 2. Remove Signature node
    foreach ($xpath->query('//cac:Signature') as $el) {
        $el->parentNode->removeChild($el);
    }

    // 3. Remove QR AdditionalDocumentReference
    foreach ($xpath->query('//cac:AdditionalDocumentReference[cbc:ID="QR"]') as $el) {
        $el->parentNode->removeChild($el);
    }

    $canonicalXml = $dom->C14N(false, false);
    $binaryHash = hash('sha256', $canonicalXml, true);
    $base64Hash = base64_encode($binaryHash);

    echo json_encode([
        'hash' => $base64Hash,
        'hashHex' => bin2hex($binaryHash),
        'canonicalXml' => $canonicalXml,
    ]);
    exit(0);
}

if ($action === 'c14n') {
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = false;
    $dom->preserveWhiteSpace = true;
    $dom->loadXML($input);
    echo $dom->C14N(false, false);
    exit(0);
}
