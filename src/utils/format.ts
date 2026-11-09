/**
 * Utilitas pemformatan data untuk multi-operator seluler
 */

/**
 * Memformat nominal Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Menstandarisasi nomor HP ke format nasional Indonesia (08xxxxxxxxxx)
 * Menangani input: 628xxx, +628xxx, 8xxx, 08xxx
 */
export function formatPhoneNumber(phone: string | number | null | undefined): string {
  if (!phone) return '';
  let clean = String(phone).trim().replace(/[^0-9+]/g, '');

  if (clean.startsWith('+62')) {
    clean = '0' + clean.slice(3);
  } else if (clean.startsWith('62')) {
    clean = '0' + clean.slice(2);
  } else if (clean.startsWith('8')) {
    clean = '0' + clean;
  }

  return clean;
}

/**
 * Menstandarisasi format tanggal ke format ISO YYYY-MM-DD
 * Menangani berbagai variasi response API:
 * - YYYY-MM-DD (2026-12-15)
 * - YYYYMMDDTHH:mm:ss+ZZZZ (20270224T12:00:00+0000)
 * - DD MMM YYYY (24 Feb 2027, 27 Aug 2027)
 * - DD.MM.YYYY atau DD/MM/YYYY (27.08.2027)
 * - String dengan awalan teks seperti "Berakhir pada 27 Aug 2027", "Berlaku hingga 24 Feb 27"
 * - Integer compact YYYYMMDD (20270827)
 */
export function formatDate(val: string | number | Date | null | undefined): string {
  if (!val) return '';

  if (typeof val === 'number') {
    const s = String(val);
    if (s.length === 8) {
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  let str = String(val).trim();

  // Bersihkan awalan kata keterangan umum bahasa Indonesia & Inggris
  str = str.replace(/^(Berakhir pada|Berlaku hingga|Expired on)\s+/i, '');

  // Format compact ISO: 20270224T12:00:00+0000
  const isoCompactMatch = str.match(/^(\d{4})(\d{2})(\d{2})T/);
  if (isoCompactMatch) {
    return `${isoCompactMatch[1]}-${isoCompactMatch[2]}-${isoCompactMatch[3]}`;
  }

  // Format standard YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  // Format DD.MM.YYYY atau DD/MM/YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    return `${ddmmyyyyMatch[3]}-${month}-${day}`;
  }

  // Format text: 24 Feb 2027, 27 Aug 2027, 24 Feb 27
  const monthMap: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    mei: '05',
    may: '05',
    jun: '06',
    jul: '07',
    agu: '08',
    aug: '08',
    sep: '09',
    okt: '10',
    oct: '10',
    nov: '11',
    des: '12',
    dec: '12',
  };

  const wordMatch = str.match(/^(\d{1,2})\s+([a-zA-Z]{3,})\s+(\d{2,4})/);
  if (wordMatch) {
    const day = wordMatch[1].padStart(2, '0');
    const mStr = wordMatch[2].toLowerCase().slice(0, 3);
    const month = monthMap[mStr] || '01';
    let year = wordMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  // Fallback parsing Date standar
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return str;
}

