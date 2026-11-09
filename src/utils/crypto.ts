import crypto from 'node:crypto';

export function sha512(str: string): string {
  return crypto.createHash('sha512').update(str).digest('hex');
}

export function getOddPositionCharacters(str: string): string {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    if (i % 2 === 0) {
      res += str[i];
    }
  }
  return res;
}

/**
 * Menghitung nilai header `x-imi-oauth`
 * Rumus asli dari portal Bima+ IOH:
 * SHA512("REQBODY=" + jsonBody + "&SALT=" + getOddPositionCharacters(tokenId))
 */
export function getSHA512EncryptedBody(tokenId: string, bodyString: string): string {
  const salt = getOddPositionCharacters(tokenId || '');
  return sha512(`REQBODY=${bodyString}&SALT=${salt}`);
}

/**
 * Menghitung nilai header `X-IMI-HASH`
 * Rumus asli dari portal Bima+ IOH:
 * SHA512(hashParams + "&SALT=" + getOddPositionCharacters(uid))
 * di mana hashParams = "parent$BROWSER$5.2.0$" + tokenId
 */
export function getSHA512Encrypted(uid: string, hashParams: string): string {
  const salt = getOddPositionCharacters(uid || '');
  return sha512(`${hashParams}&SALT=${salt}`);
}

/**
 * Membuat UID dinamis berformat: YYYYMMDDHHmmssSSS + 3 angka acak
 * Sesuai implementasi portal Bima+:
 * (new Date).format("yyyyMMDDHHmmssSSS") + GenerateRandomNumber(100, 999)
 */
export function generateUid(): string {
  const pad = (n: number, z = 2) => ('00' + n).slice(-z);
  const now = new Date();
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const sss = pad(now.getMilliseconds(), 3);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}${sss}${rand}`;
}

