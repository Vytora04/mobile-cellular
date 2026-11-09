import axios, { AxiosInstance } from 'axios';
import { OperatorAdapter, OperatorName, QuotaReport } from '../types/index.js';
import { formatPhoneNumber } from '../utils/format.js';

export abstract class BaseOperatorAdapter implements OperatorAdapter {
  abstract readonly operator: OperatorName;
  readonly phoneNumber: string;
  protected client: AxiosInstance;
  protected isMock: boolean;

  constructor(phoneNumber: string, baseURL: string = '', isMock: boolean = true) {
    this.phoneNumber = formatPhoneNumber(phoneNumber);
    this.isMock = isMock;
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Content-Type': 'application/json',
      },
    });
  }

  abstract loginWithOtp(
    phone: string,
    otp?: string
  ): Promise<{ success: boolean; message: string; token?: string }>;

  abstract checkQuota(): Promise<QuotaReport>;
}
