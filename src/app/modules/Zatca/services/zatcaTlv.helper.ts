/**
 * ZatcaTlvHelper
 * Implements Tag-Length-Value (TLV) encoding according to Saudi Arabia ZATCA Phase 2 specifications.
 */
export class ZatcaTlvHelper {
  /**
   * Encode an object of { [tagNumber]: string | Buffer } into Base64 TLV string.
   */
  public static encode(tags: Record<number, string | Buffer>): string {
    const buffers: Buffer[] = [];

    const sortedTagKeys = Object.keys(tags)
      .map(Number)
      .sort((a, b) => a - b);

    for (const tag of sortedTagKeys) {
      const val = tags[tag];
      const valBuffer = Buffer.isBuffer(val) ? val : Buffer.from(String(val), 'utf8');
      const tagBuffer = Buffer.from([tag]);
      const lengthBuffer = this.encodeLength(valBuffer.length);

      buffers.push(tagBuffer, lengthBuffer, valBuffer);
    }

    return Buffer.concat(buffers).toString('base64');
  }

  /**
   * ZATCA TLV encodes length as exactly 1 single byte (max 255 bytes per tag).
   */
  protected static encodeLength(length: number): Buffer {
    return Buffer.from([length & 0xff]);
  }

  /**
   * Decode a Base64 TLV string back into an object of tags.
   */
  public static decode(base64Tlv: string): Record<number, string | Buffer> {
    const buf = Buffer.from(base64Tlv, 'base64');
    const result: Record<number, string | Buffer> = {};
    let offset = 0;

    while (offset < buf.length) {
      const tag = buf[offset++];
      if (offset >= buf.length) break;
      const valLen = buf[offset++];
      const valBuf = buf.subarray(offset, offset + valLen);
      offset += valLen;
      if (tag <= 6) {
        result[tag] = valBuf.toString('utf8');
      } else {
        result[tag] = valBuf;
      }
    }

    return result;
  }
}
