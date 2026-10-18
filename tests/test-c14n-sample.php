<?php
$sample = file_get_contents('C:/Users/User/.gemini/antigravity-ide/brain/76dc1054-faaa-4dd3-bfa6-5d207b00c4a7/scratch/package/lib/samples/index.js');
preg_match('/<Invoice[\s\S]*?<\/Invoice>/', $sample, $matches);
$xml = $matches[0];
$dom = new DOMDocument();
$dom->loadXML($xml);
$xpath = new DOMXPath($dom);
$node = $xpath->query('//*[@Id="xadesSignedProperties"]')->item(0);
$c14n = $node->C14N(false, false);
echo "--- C14N output ---\n" . $c14n . "\n---\n";
$hex = hash('sha256', $c14n);
$b64 = base64_encode($hex);
echo "Computed Hex: " . $hex . "\n";
echo "Computed Base64: " . $b64 . "\n";
echo "Sample Base64:   MjNlMDdlOTNlNTAyMjJlMjRjNWZiY2RkOWRhNWE0ZGI1ODgxZGRkZjJiZWExZjA2ZTNhY2RlYzFjMTFlZjE5MA==\n";
echo "MATCH: " . ($b64 === 'MjNlMDdlOTNlNTAyMjJlMjRjNWZiY2RkOWRhNWE0ZGI1ODgxZGRkZjJiZWExZjA2ZTNhY2RlYzFjMTFlZjE5MA==' ? 'YES' : 'NO') . "\n";
