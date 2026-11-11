import {
  OPERATORS,
  OperatorType,
  detectOperatorByPrefix,
  requestOperatorOtp,
  verifyOperatorOtp,
  loginWithTokenId,
  fetchOperatorDashboard,
  getAllSessions,
  getSession,
  getActivePhone,
  setActivePhone,
  removeSession,
  getSessionOrder,
  moveSessionOrder,
  checkTokenStatus,
  formatRupiah,
  formatPhoneNumber,
  syncSavedSessionsFromDisk,
  MobileQuotaReport,
} from './services/operatorClient';

// --- DOM ELEMENTS ---
const brandLogo = document.getElementById('brand-logo') as HTMLElement;
const screenLogin = document.getElementById('screen-login') as HTMLElement;
const screenDashboard = document.getElementById('screen-dashboard') as HTMLElement;
const headerActions = document.getElementById('header-actions') as HTMLElement;
const alertBox = document.getElementById('alert-box') as HTMLElement;
const statusDot = document.getElementById('status-dot') as HTMLElement;
const statusLabel = document.getElementById('status-label') as HTMLElement;

// Login Elements
const loginPortalBadge = document.getElementById('login-portal-badge') as HTMLElement;
const loginModeBadge = document.getElementById('login-mode-badge') as HTMLElement;
const prefixDetectBadge = document.getElementById('prefix-detect-badge') as HTMLElement;
const operatorTabButtons = document.querySelectorAll<HTMLButtonElement>('.op-tab-btn');
const labelPhone = document.getElementById('label-phone') as HTMLElement;
const inputPhone = document.getElementById('input-phone') as HTMLInputElement;
const btnRequestOtp = document.getElementById('btn-request-otp') as HTMLButtonElement;
const inputOtp = document.getElementById('input-otp') as HTMLInputElement;
const btnVerifyOtp = document.getElementById('btn-verify-otp') as HTMLButtonElement;
const inputToken = document.getElementById('input-token') as HTMLTextAreaElement;
const btnLoginToken = document.getElementById('btn-login-token') as HTMLButtonElement;
const btnCancelLogin = document.getElementById('btn-cancel-login') as HTMLButtonElement;

// Dashboard Elements
const simCountBadge = document.getElementById('sim-count-badge') as HTMLElement;
const simCardsStrip = document.getElementById('sim-cards-strip') as HTMLElement;
const btnAddAccount = document.getElementById('btn-add-account') as HTMLButtonElement;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement;
const refreshIcon = document.getElementById('refresh-icon') as HTMLElement;

const heroBalanceCard = document.getElementById('hero-balance-card') as HTMLElement;
const heroOpBadge = document.getElementById('hero-op-badge') as HTMLElement;
const heroPhoneNumber = document.getElementById('hero-phone-number') as HTMLElement;
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

let selectedOperator: OperatorType = 'tri';
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

function setLiveStatus(state: 'online' | 'loading' | 'error' | 'mock', text: string): void {
  statusDot.classList.remove('bg-emerald-400', 'bg-amber-400', 'bg-rose-500');
  statusLabel.classList.remove('text-emerald-400', 'text-amber-400', 'text-rose-400');

  if (state === 'online') {
    statusDot.classList.add('bg-emerald-400');
    statusLabel.classList.add('text-emerald-400');
  } else if (state === 'loading' || state === 'mock') {
    statusDot.classList.add('bg-amber-400');
    statusLabel.classList.add('text-amber-400');
  } else {
    statusDot.classList.add('bg-rose-500');
    statusLabel.classList.add('text-rose-400');
  }
  statusLabel.textContent = text;
}

// --- OPERATOR SELECTION & THEME ---

function selectOperator(op: OperatorType, isAutoDetected: boolean = false): void {
  selectedOperator = op;
  const meta = OPERATORS[op];

  // Update Tab Active Styles
  operatorTabButtons.forEach((btn) => {
    const btnOp = btn.getAttribute('data-op') as OperatorType;
    btn.classList.remove(
      'border-red-500',
      'bg-red-500/10',
      'border-rose-500',
      'bg-rose-500/10',
      'border-amber-500',
      'bg-amber-500/10',
      'border-blue-500',
      'bg-blue-500/10',
      'border-pink-500',
      'bg-pink-500/10',
      'border-slate-800',
      'bg-slate-950/60'
    );

    if (btnOp === op) {
      if (op === 'telkomsel') {
        btn.classList.add('border-red-500', 'bg-red-500/10');
      } else if (op === 'tri') {
        btn.classList.add('border-rose-500', 'bg-rose-500/10');
      } else if (op === 'indosat') {
        btn.classList.add('border-amber-500', 'bg-amber-500/10');
      } else if (op === 'xl') {
        btn.classList.add('border-blue-500', 'bg-blue-500/10');
      } else if (op === 'smartfren') {
        btn.classList.add('border-pink-500', 'bg-pink-500/10');
      }
    } else {
      btn.classList.add('border-slate-800', 'bg-slate-950/60');
    }
  });

  // Update Portal & Mode Badges
  loginPortalBadge.textContent = `Portal ${meta.portalName}`;
  loginModeBadge.textContent = meta.mode;
  loginModeBadge.className = `px-2.5 py-1 rounded-xl border text-[10px] font-bold uppercase tracking-wider shrink-0 ${meta.badgeClass}`;

  // Update Phone Label & Placeholder
  labelPhone.textContent = `Nomor HP ${meta.name}`;
  inputPhone.placeholder = meta.placeholder;

  if (meta.isAvailable === false) {
    btnVerifyOtp.disabled = true;
    btnVerifyOtp.textContent = 'Operator Belum Tersedia';
    btnVerifyOtp.className =
      'w-full py-3 rounded-xl bg-slate-800 text-sm font-bold text-slate-500 cursor-not-allowed';
    btnRequestOtp.disabled = true;
    btnRequestOtp.className =
      'px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-600 cursor-not-allowed whitespace-nowrap';
    btnLoginToken.disabled = true;
    showAlert(
      `Operator ${meta.name} saat ini belum tersedia (belum dapat dikonfigurasi).`,
      'info'
    );
  } else {
    btnVerifyOtp.disabled = false;
    btnVerifyOtp.textContent = 'Verifikasi & Masuk';
    btnVerifyOtp.className = `w-full py-3 rounded-xl bg-gradient-to-r ${meta.accentGradient} hover:opacity-95 active:scale-[0.99] text-sm font-bold text-white shadow-lg transition cursor-pointer`;
    btnRequestOtp.disabled = false;
    btnRequestOtp.className = `px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-xs font-semibold ${meta.textAccentClass} whitespace-nowrap transition cursor-pointer`;
    btnLoginToken.disabled = false;
  }

  if (isAutoDetected) {
    prefixDetectBadge.classList.remove('hidden');
  } else {
    prefixDetectBadge.classList.add('hidden');
  }
}

// --- NAVIGATION ---

function showLoginScreen(allowCancel: boolean = false): void {
  hideAlert();
  screenDashboard.classList.add('hidden');
  headerActions.classList.add('hidden');
  headerActions.classList.remove('flex');
  screenLogin.classList.remove('hidden');

  selectOperator(selectedOperator, false);

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
  renderSimCardsStrip();
}

// --- MULTI-SIM TRACKER STRIP ---

function renderSimCardsStrip(): void {
  const sessions = getAllSessions();
  const phones = getSessionOrder();
  const active = getActivePhone();

  simCountBadge.textContent = `${phones.length} SIM`;
  simCardsStrip.innerHTML = '';

  phones.forEach((phone, index) => {
    const sess = sessions[phone];
    if (!sess) return;
    const opMeta = OPERATORS[sess.operator] || OPERATORS.tri;
    const isActive = phone === active;

    const pill = document.createElement('div');
    pill.draggable = true;
    pill.className = isActive
      ? `group relative flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/25 bg-gradient-to-r ${opMeta.accentGradient} text-white shadow-md shrink-0 transition select-none cursor-pointer`
      : 'group relative flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800 text-slate-300 shrink-0 transition select-none cursor-pointer';

    pill.innerHTML = `
      <span class="w-2 h-2 rounded-full ${isActive ? 'bg-white' : opMeta.dotClass}"></span>
      <div class="text-left flex-1" data-action="select">
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] font-extrabold uppercase tracking-wide">${opMeta.shortName}</span>
          <span class="text-[9px] px-1.5 py-0.2 rounded bg-black/30 font-semibold">
            ${sess.isMock ? 'MOCK' : 'LIVE'}
          </span>
          <span class="text-[9px] opacity-75 font-mono font-bold">#${index + 1}</span>
        </div>
        <div class="text-xs font-mono font-semibold">${phone}</div>
      </div>
      <div class="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
        ${index > 0 ? `<button type="button" class="btn-shift-left hover:scale-125 px-1 text-[11px] font-bold" title="Geser ke Urutan Sebelumnya">◀</button>` : ''}
        ${index < phones.length - 1 ? `<button type="button" class="btn-shift-right hover:scale-125 px-1 text-[11px] font-bold" title="Geser ke Urutan Selanjutnya">▶</button>` : ''}
      </div>
    `;

    pill.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.btn-shift-left') || target.closest('.btn-shift-right')) {
        return;
      }
      if (phone !== getActivePhone()) {
        setActivePhone(phone);
        loadActiveAccountDashboard(false);
      }
    });

    const btnLeft = pill.querySelector('.btn-shift-left');
    btnLeft?.addEventListener('click', (e) => {
      e.stopPropagation();
      moveSessionOrder(phone, 'left');
      renderSimCardsStrip();
    });

    const btnRight = pill.querySelector('.btn-shift-right');
    btnRight?.addEventListener('click', (e) => {
      e.stopPropagation();
      moveSessionOrder(phone, 'right');
      renderSimCardsStrip();
    });

    pill.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', phone);
      pill.classList.add('opacity-40');
    });
    pill.addEventListener('dragend', () => {
      pill.classList.remove('opacity-40');
    });
    pill.addEventListener('dragover', (e) => {
      e.preventDefault();
      pill.classList.add('ring-2', 'ring-white/70');
    });
    pill.addEventListener('dragleave', () => {
      pill.classList.remove('ring-2', 'ring-white/70');
    });
    pill.addEventListener('drop', (e) => {
      e.preventDefault();
      pill.classList.remove('ring-2', 'ring-white/70');
      const dragged = e.dataTransfer?.getData('text/plain');
      if (dragged && dragged !== phone) {
        moveSessionOrder(dragged, index);
        renderSimCardsStrip();
      }
    });

    simCardsStrip.appendChild(pill);
  });
}

// --- RENDER DASHBOARD DATA ---

function renderQuotaReport(report: MobileQuotaReport, tokenId?: string): void {
  const opMeta = OPERATORS[report.operator] || OPERATORS.tri;

  // Update Hero Card Theme & Header
  heroBalanceCard.className = `relative overflow-hidden rounded-3xl bg-gradient-to-br ${opMeta.cardGradient} p-5 shadow-xl transition-all`;
  brandLogo.className = `w-10 h-10 rounded-2xl bg-gradient-to-br ${opMeta.accentGradient} flex items-center justify-center shadow-lg font-extrabold text-sm tracking-tighter text-white transition-all`;

  heroOpBadge.textContent = opMeta.shortName;
  heroPhoneNumber.textContent = report.phoneNumber;
  valBalance.textContent = formatRupiah(report.balance);
  valActiveUntil.textContent = report.activeUntil;
  valUpdatedAt.textContent = `Pukul ${report.fetchedAt}`;

  if (report.isMock) {
    badgeTokenTtl.textContent = 'MOCK MODE';
    badgeTokenTtl.className =
      'px-2.5 py-0.5 rounded-full bg-black/35 backdrop-blur-sm text-[10px] font-bold text-amber-300';
  } else {
    const tokenStatus = checkTokenStatus(tokenId, false);
    badgeTokenTtl.className =
      'px-2.5 py-0.5 rounded-full bg-black/35 backdrop-blur-sm text-[10px] font-bold text-emerald-300';
    if (tokenStatus.isValid && tokenStatus.daysLeft !== undefined) {
      badgeTokenTtl.textContent = `LIVE API • ${tokenStatus.daysLeft} hari`;
    } else {
      badgeTokenTtl.textContent = 'LIVE API';
    }
  }

  // Total Quota & Progress
  valTotalRemaining.textContent = `${report.totalRemainingGB} GB`;
  valTotalInitial.textContent = `/ ${report.totalInitialGB} GB`;

  const totalPct =
    report.totalInitialGB > 0
      ? Math.min(100, Math.round((report.totalRemainingGB / report.totalInitialGB) * 1000) / 10)
      : 0;

  valTotalPct.textContent = `${totalPct}%`;
  barTotalQuota.className = `h-full bg-gradient-to-r ${opMeta.accentGradient} rounded-full transition-all duration-500`;
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
        <span class="px-2.5 py-1 rounded-xl bg-slate-800 text-xs font-bold ${opMeta.textAccentClass} shrink-0">
          ${pkg.percentage}%
        </span>
      </div>

      <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden my-2.5">
        <div
          class="h-full bg-gradient-to-r ${opMeta.accentGradient} rounded-full transition-all duration-500"
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
  if (!session || !checkTokenStatus(session.tokenId, session.isMock).isValid) {
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

  try {
    refreshIcon.classList.add('spin-anim');
    btnRefresh.disabled = true;
    setLiveStatus('loading', 'Memperbarui data...');

    const report = await fetchOperatorDashboard(activePhone);
    renderQuotaReport(report, session.tokenId);
    renderSimCardsStrip();

    if (report.isMock) {
      setLiveStatus('mock', `${OPERATORS[report.operator].shortName} • Mock Mode`);
    } else {
      setLiveStatus('online', `${OPERATORS[report.operator].shortName} • Live API`);
    }

    if (showToastOnSuccess) {
      showAlert(`Data ${OPERATORS[report.operator].shortName} (${activePhone}) berhasil diperbarui!`, 'success');
      setTimeout(hideAlert, 3000);
    }
  } catch (err: any) {
    setLiveStatus('error', 'Gagal memuat');
    showAlert(err?.message || 'Gagal menyegarkan data operator.', 'error');
  } finally {
    refreshIcon.classList.remove('spin-anim');
    btnRefresh.disabled = false;
  }
}

// --- EVENT LISTENERS ---

// 1. Klik Tab Operator Manual
operatorTabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const op = btn.getAttribute('data-op') as OperatorType;
    if (op) {
      if (OPERATORS[op]?.isAvailable === false) {
        showAlert(
          `Operator ${OPERATORS[op].name} saat ini belum tersedia (belum dapat dikonfigurasi).`,
          'info'
        );
        return;
      }
      hideAlert();
      selectOperator(op, false);
    }
  });
});

// 2. Auto-Detect Operator saat Mengetik Nomor HP
inputPhone.addEventListener('input', () => {
  const detected = detectOperatorByPrefix(inputPhone.value);
  if (detected) {
    if (OPERATORS[detected]?.isAvailable === false) {
      showAlert(
        `Nomor ini terdeteksi sebagai ${OPERATORS[detected].name}, namun operator ini saat ini belum dapat dikonfigurasi.`,
        'info'
      );
      prefixDetectBadge.classList.add('hidden');
    } else {
      hideAlert();
      selectOperator(detected, true);
    }
  } else {
    prefixDetectBadge.classList.add('hidden');
  }
});

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

// 3. Minta OTP
btnRequestOtp.addEventListener('click', async () => {
  hideAlert();
  const phone = formatPhoneNumber(inputPhone.value);
  if (!phone || phone.length < 9) {
    showAlert('Masukkan nomor HP yang valid terlebih dahulu.', 'error');
    inputPhone.focus();
    return;
  }

  // Deteksi ulang jika prefix cocok
  const detected = detectOperatorByPrefix(phone);
  if (detected && detected !== selectedOperator) {
    selectOperator(detected, true);
  }

  inputPhone.value = phone;
  btnRequestOtp.disabled = true;
  btnRequestOtp.textContent = 'Mengirim...';
  setLiveStatus('loading', 'Mengirim OTP...');

  const res = await requestOperatorOtp(selectedOperator, phone);
  if (res.success) {
    if (res.isMock) {
      setLiveStatus('mock', 'Simulasi OTP Siap');
      inputOtp.value = '123456';
      btnRequestOtp.disabled = false;
      btnRequestOtp.textContent = 'Minta OTP';
    } else {
      setLiveStatus('online', 'OTP Terkirim');
      startOtpCooldown(60);
    }
    showAlert(res.message, 'success');
    inputOtp.focus();
  } else {
    setLiveStatus('error', 'Gagal OTP');
    btnRequestOtp.disabled = false;
    btnRequestOtp.textContent = 'Minta OTP';
    showAlert(res.message, 'error');
  }
});

// 4. Verifikasi OTP & Masuk
btnVerifyOtp.addEventListener('click', async () => {
  hideAlert();
  const phone = formatPhoneNumber(inputPhone.value);
  const otp = inputOtp.value.trim();

  if (!phone) {
    showAlert('Nomor HP tidak boleh kosong.', 'error');
    return;
  }
  if (otp.length !== 6) {
    showAlert('Masukkan 6 digit kode OTP.', 'error');
    inputOtp.focus();
    return;
  }

  btnVerifyOtp.disabled = true;
  btnVerifyOtp.textContent = 'Memverifikasi...';
  setLiveStatus('loading', 'Verifikasi OTP...');

  const res = await verifyOperatorOtp(selectedOperator, phone, otp);
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

// 5. Login Cepat dengan Token
btnLoginToken.addEventListener('click', async () => {
  hideAlert();
  const phone = formatPhoneNumber(inputPhone.value);
  const token = inputToken.value.trim();

  if (!phone || phone.length < 9) {
    showAlert('Isi Nomor HP pada kolom di atas terlebih dahulu.', 'error');
    inputPhone.focus();
    return;
  }
  if (!token && selectedOperator === 'tri') {
    showAlert('Tempelkan tokenId Tri Anda terlebih dahulu.', 'error');
    inputToken.focus();
    return;
  }

  const res = await loginWithTokenId(selectedOperator, phone, token);
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

btnAddAccount.addEventListener('click', () => {
  inputPhone.value = '';
  inputOtp.value = '';
  showLoginScreen(true);
});

const btnSetFirst = document.getElementById('btn-set-first') as HTMLButtonElement | null;
btnSetFirst?.addEventListener('click', () => {
  const active = getActivePhone();
  if (!active) return;
  moveSessionOrder(active, 'first');
  renderSimCardsStrip();
  showAlert(`Nomor ${active} dipindahkan ke urutan pertama (#1)!`, 'info');
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
    showAlert(`Nomor ${active} telah dihapus dari perangkat.`, 'info');
  }
});

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
  await syncSavedSessionsFromDisk();
  const active = getActivePhone();
  if (active && getSession(active)) {
    loadActiveAccountDashboard(false);
  } else {
    showLoginScreen(false);
  }
});
