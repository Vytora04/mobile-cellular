import {
  requestTriOtp,
  verifyTriOtp,
  loginWithTokenId,
  fetchTriDashboard,
  getAllSessions,
  getSession,
  getActivePhone,
  setActivePhone,
  removeSession,
  checkTokenStatus,
  formatRupiah,
  formatPhoneNumber,
  MobileQuotaReport,
} from './services/triClient';

// --- DOM ELEMENTS ---
const screenLogin = document.getElementById('screen-login') as HTMLElement;
const screenDashboard = document.getElementById('screen-dashboard') as HTMLElement;
const headerActions = document.getElementById('header-actions') as HTMLElement;
const alertBox = document.getElementById('alert-box') as HTMLElement;
const statusDot = document.getElementById('status-dot') as HTMLElement;
const statusLabel = document.getElementById('status-label') as HTMLElement;

// Login Elements
const inputPhone = document.getElementById('input-phone') as HTMLInputElement;
const btnRequestOtp = document.getElementById('btn-request-otp') as HTMLButtonElement;
const inputOtp = document.getElementById('input-otp') as HTMLInputElement;
const btnVerifyOtp = document.getElementById('btn-verify-otp') as HTMLButtonElement;
const inputToken = document.getElementById('input-token') as HTMLTextAreaElement;
const btnLoginToken = document.getElementById('btn-login-token') as HTMLButtonElement;
const btnCancelLogin = document.getElementById('btn-cancel-login') as HTMLButtonElement;

// Dashboard Elements
const selectAccount = document.getElementById('select-account') as HTMLSelectElement;
const btnAddAccount = document.getElementById('btn-add-account') as HTMLButtonElement;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement;
const refreshIcon = document.getElementById('refresh-icon') as HTMLElement;

const badgeTokenTtl = document.getElementById('badge-token-ttl') as HTMLElement;
const valBalance = document.getElementById('val-balance') as HTMLElement;
const valActiveUntil = document.getElementById('val-active-until') as HTMLElement;
const valUpdatedAt = document.getElementById('val-updated-at') as HTMLElement;

const valTotalRemaining = document.getElementById('val-total-remaining') as HTMLElement;
const valTotalInitial = document.getElementById('val-total-initial') as HTMLElement;
const valTotalPct = document.getElementById('val-total-pct') as HTMLElement;
const barTotalQuota = document.getElementById('bar-total-quota') as HTMLElement;

const valPkgCount = document.getElementById('val-pkg-count') as HTMLElement;
const packagesList = document.getElementById('packages-list') as HTMLElement;

let otpCooldownTimer: number | null = null;

// --- UI HELPERS ---

function showAlert(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  alertBox.classList.remove(
    'hidden',
    'bg-emerald-950/80',
    'border-emerald-500/40',
    'text-emerald-200',
    'bg-rose-950/80',
    'border-rose-500/40',
    'text-rose-200',
    'bg-slate-900/90',
    'border-slate-700',
    'text-slate-200'
  );

  if (type === 'success') {
    alertBox.classList.add('bg-emerald-950/80', 'border-emerald-500/40', 'text-emerald-200');
  } else if (type === 'error') {
    alertBox.classList.add('bg-rose-950/80', 'border-rose-500/40', 'text-rose-200');
  } else {
    alertBox.classList.add('bg-slate-900/90', 'border-slate-700', 'text-slate-200');
  }

  alertBox.textContent = message;
}

function hideAlert(): void {
  alertBox.classList.add('hidden');
}

function setLiveStatus(state: 'online' | 'loading' | 'error', text: string): void {
  statusDot.classList.remove('bg-emerald-400', 'bg-amber-400', 'bg-rose-500');
  statusLabel.classList.remove('text-emerald-400', 'text-amber-400', 'text-rose-400');

  if (state === 'online') {
    statusDot.classList.add('bg-emerald-400');
    statusLabel.classList.add('text-emerald-400');
  } else if (state === 'loading') {
    statusDot.classList.add('bg-amber-400');
    statusLabel.classList.add('text-amber-400');
  } else {
    statusDot.classList.add('bg-rose-500');
    statusLabel.classList.add('text-rose-400');
  }
  statusLabel.textContent = text;
}

// --- NAVIGATION ---

function showLoginScreen(allowCancel: boolean = false): void {
  hideAlert();
  screenDashboard.classList.add('hidden');
  headerActions.classList.add('hidden');
  headerActions.classList.remove('flex');
  screenLogin.classList.remove('hidden');

  if (allowCancel && Object.keys(getAllSessions()).length > 0) {
    btnCancelLogin.classList.remove('hidden');
  } else {
    btnCancelLogin.classList.add('hidden');
  }
}

function showDashboardScreen(): void {
  hideAlert();
  screenLogin.classList.add('hidden');
  screenDashboard.classList.remove('hidden');
  headerActions.classList.remove('hidden');
  headerActions.classList.add('flex');
  populateAccountSelector();
}

function populateAccountSelector(): void {
  const sessions = getAllSessions();
  const phones = Object.keys(sessions);
  const active = getActivePhone();

  selectAccount.innerHTML = '';
  phones.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = `Tri • ${p}`;
    opt.className = 'bg-slate-900 text-white';
    if (p === active) opt.selected = true;
    selectAccount.appendChild(opt);
  });
}

// --- RENDER DASHBOARD DATA ---

function renderQuotaReport(report: MobileQuotaReport, tokenId?: string): void {
  valBalance.textContent = formatRupiah(report.balance);
  valActiveUntil.textContent = report.activeUntil;
  valUpdatedAt.textContent = `Pukul ${report.fetchedAt}`;

  const tokenStatus = checkTokenStatus(tokenId);
  if (tokenStatus.isValid && tokenStatus.daysLeft !== undefined) {
    badgeTokenTtl.textContent = `Sesi Aktif • ${tokenStatus.daysLeft} hari`;
  } else {
    badgeTokenTtl.textContent = 'Sesi Aktif';
  }

  // Total Quota & Progress
  valTotalRemaining.textContent = `${report.totalRemainingGB} GB`;
  valTotalInitial.textContent = `/ ${report.totalInitialGB} GB`;

  const totalPct =
    report.totalInitialGB > 0
      ? Math.min(100, Math.round((report.totalRemainingGB / report.totalInitialGB) * 1000) / 10)
      : 0;

  valTotalPct.textContent = `${totalPct}%`;
  barTotalQuota.style.width = `${totalPct}%`;

  // Packages List
  valPkgCount.textContent = `${report.packages.length} Paket`;
  packagesList.innerHTML = '';

  if (report.packages.length === 0) {
    packagesList.innerHTML = `
      <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 text-center text-xs text-slate-400">
        Tidak ada paket internet aktif saat ini.
      </div>
    `;
    return;
  }

  report.packages.forEach((pkg) => {
    const card = document.createElement('div');
    card.className =
      'bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-md transition hover:border-slate-700';

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0 flex-1">
          <h4 class="text-sm font-bold text-white truncate">${pkg.name}</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">
            Berlaku s/d <span class="text-slate-300 font-medium">${pkg.expiresAt}</span>
          </p>
        </div>
        <span class="px-2.5 py-1 rounded-xl bg-slate-800 text-xs font-bold text-rose-400 shrink-0">
          ${pkg.percentage}%
        </span>
      </div>

      <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden my-2.5">
        <div
          class="h-full bg-gradient-to-r from-rose-500 to-purple-500 rounded-full transition-all duration-500"
          style="width: ${pkg.percentage}%"
        ></div>
      </div>

      <div class="flex items-center justify-between text-xs">
        <span class="text-slate-400">Sisa Kuota</span>
        <div>
          <span class="font-bold text-white">${pkg.remainingGB} GB</span>
          <span class="text-slate-500"> / ${pkg.totalGB} GB</span>
        </div>
      </div>
    `;

    packagesList.appendChild(card);
  });
}

// --- REFRESH FLOW ---

async function loadActiveAccountDashboard(showToastOnSuccess: boolean = false): Promise<void> {
  const activePhone = getActivePhone();
  if (!activePhone) {
    showLoginScreen(false);
    return;
  }

  const session = getSession(activePhone);
  if (!session || !checkTokenStatus(session.tokenId).isValid) {
    removeSession(activePhone);
    const nextPhone = getActivePhone();
    if (nextPhone) {
      await loadActiveAccountDashboard();
    } else {
      showLoginScreen(false);
      showAlert('Sesi telah berakhir. Silakan login kembali.', 'info');
    }
    return;
  }

  showDashboardScreen();

  // Tampilkan data terakhir dari cache terlebih dahulu jika ada
  if (session.lastReport) {
    renderQuotaReport(session.lastReport, session.tokenId);
  }

  // Ambil data live dari Bima+
  try {
    refreshIcon.classList.add('spin-anim');
    btnRefresh.disabled = true;
    setLiveStatus('loading', 'Memperbarui data...');

    const liveReport = await fetchTriDashboard(activePhone);
    renderQuotaReport(liveReport, session.tokenId);
    setLiveStatus('online', 'Live • Terhubung');

    if (showToastOnSuccess) {
      showAlert(`Data kuota ${activePhone} berhasil diperbarui!`, 'success');
      setTimeout(hideAlert, 3000);
    }
  } catch (err: any) {
    setLiveStatus('error', 'Gagal memuat');
    showAlert(err?.message || 'Gagal menyegarkan data dari server Tri.', 'error');
  } finally {
    refreshIcon.classList.remove('spin-anim');
    btnRefresh.disabled = false;
  }
}

// --- EVENT LISTENERS ---

function startOtpCooldown(seconds: number = 60): void {
  if (otpCooldownTimer) clearInterval(otpCooldownTimer);
  let remaining = seconds;
  btnRequestOtp.disabled = true;

  otpCooldownTimer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      if (otpCooldownTimer) clearInterval(otpCooldownTimer);
      btnRequestOtp.disabled = false;
      btnRequestOtp.textContent = 'Minta OTP';
    } else {
      btnRequestOtp.textContent = `Tunggu (${remaining}d)`;
    }
  }, 1000);
}

btnRequestOtp.addEventListener('click', async () => {
  hideAlert();
  const phone = formatPhoneNumber(inputPhone.value);
  if (!phone || phone.length < 9) {
    showAlert('Masukkan nomor HP Tri yang valid terlebih dahulu.', 'error');
    inputPhone.focus();
    return;
  }

  inputPhone.value = phone;
  btnRequestOtp.disabled = true;
  btnRequestOtp.textContent = 'Mengirim...';
  setLiveStatus('loading', 'Mengirim OTP...');

  const res = await requestTriOtp(phone);
  if (res.success) {
    setLiveStatus('online', 'OTP Terkirim');
    showAlert(res.message, 'success');
    startOtpCooldown(60);
    inputOtp.focus();
  } else {
    setLiveStatus('error', 'Gagal OTP');
    btnRequestOtp.disabled = false;
    btnRequestOtp.textContent = 'Minta OTP';
    showAlert(res.message, 'error');
  }
});

btnVerifyOtp.addEventListener('click', async () => {
  hideAlert();
  const phone = formatPhoneNumber(inputPhone.value);
  const otp = inputOtp.value.trim();

  if (!phone) {
    showAlert('Nomor HP tidak boleh kosong.', 'error');
    return;
  }
  if (otp.length !== 6) {
    showAlert('Masukkan 6 digit kode OTP dari SMS.', 'error');
    inputOtp.focus();
    return;
  }

  btnVerifyOtp.disabled = true;
  btnVerifyOtp.textContent = 'Memverifikasi...';
  setLiveStatus('loading', 'Verifikasi OTP...');

  const res = await verifyTriOtp(phone, otp);
  btnVerifyOtp.disabled = false;
  btnVerifyOtp.textContent = 'Verifikasi & Masuk';

  if (res.success) {
    inputOtp.value = '';
    await loadActiveAccountDashboard(true);
  } else {
    setLiveStatus('error', 'Verifikasi Gagal');
    showAlert(res.message, 'error');
  }
});

btnLoginToken.addEventListener('click', async () => {
  hideAlert();
  const phone = formatPhoneNumber(inputPhone.value);
  const token = inputToken.value.trim();

  if (!phone || phone.length < 9) {
    showAlert('Isi Nomor HP Tri pada kolom di atas terlebih dahulu.', 'error');
    inputPhone.focus();
    return;
  }
  if (!token) {
    showAlert('Tempelkan tokenId Anda terlebih dahulu.', 'error');
    inputToken.focus();
    return;
  }

  const res = await loginWithTokenId(phone, token);
  if (res.success) {
    inputToken.value = '';
    await loadActiveAccountDashboard(true);
  } else {
    showAlert(res.message, 'error');
  }
});

btnCancelLogin.addEventListener('click', () => {
  loadActiveAccountDashboard(false);
});

btnRefresh.addEventListener('click', () => {
  loadActiveAccountDashboard(true);
});

selectAccount.addEventListener('change', () => {
  const chosen = selectAccount.value;
  if (chosen) {
    setActivePhone(chosen);
    loadActiveAccountDashboard(false);
  }
});

btnAddAccount.addEventListener('click', () => {
  inputPhone.value = '';
  inputOtp.value = '';
  showLoginScreen(true);
});

btnLogout.addEventListener('click', () => {
  const active = getActivePhone();
  if (!active) return;
  removeSession(active);
  const remaining = getActivePhone();
  if (remaining) {
    loadActiveAccountDashboard(false);
  } else {
    showLoginScreen(false);
    showAlert(`Sesi nomor ${active} telah dihapus.`, 'info');
  }
});

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
  const active = getActivePhone();
  if (active && getSession(active)) {
    loadActiveAccountDashboard(false);
  } else {
    showLoginScreen(false);
  }
});
