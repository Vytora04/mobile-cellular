export type OperatorName = 'telkomsel' | 'tri' | 'indosat';

export interface PackageQuota {
  name: string;
  remainingGB: number;
  totalGB: number;
  expiresAt: string;
}

export interface QuotaReport {
  operator: OperatorName;
  phoneNumber: string;
  balance: number; // Dalam satuan Rupiah
  activeUntil: string; // Format tanggal YYYY-MM-DD atau ISO string
  packages: PackageQuota[];
}

export interface OperatorAdapter {
  readonly operator: OperatorName;
  readonly phoneNumber: string;

  /**
   * Menginisialisasi request OTP atau verifikasi kode OTP
   * @param phone Nomor telepon operator
   * @param otp Kode OTP jika proses verifikasi (opsional)
   */
  loginWithOtp(phone: string, otp?: string): Promise<{ success: boolean; message: string; token?: string }>;

  /**
   * Mengambil data sisa pulsa, masa aktif, dan rincian kuota paket
   */
  checkQuota(): Promise<QuotaReport>;
}
