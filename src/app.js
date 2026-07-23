import { renderToday, renderSettings, setSettingsTab, setPasswordResetMode } from './views/today.js';
import { renderLog, isLogBusy } from './views/log.js';
import { renderReports } from './views/reports.js';
import { onAuthChange, getUser, isSupabaseConfigured } from './services/auth.js';
import { fullSync } from './services/sync.js';
import { verifyCheckoutSession, setPlan, isPro, planLabel, syncTopUpFromCloud, syncScanStateFromProfile } from './services/subscription.js';
import { getMealsInRange, getMealsForDate, todayKey } from './services/storage.js';
import { getCuisineTips } from './services/cuisine-tips.js';
import { runPersonalisedNotificationCheck } from './services/notifications.js';
import { getProfile, getGreeting, getLocalDisplayName } from './services/profile.js';
import { openLegalModal } from './views/legal.js';
import { openAuthModal } from './services/auth-modal.js';
import { shouldShowOnboarding, openOnboardingWizard } from './services/onboarding-wizard.js';

let currentView = 'today';
let cachedProfile = null;

export function initApp() {
  const main = document.getElementById('main');
  const headerDate = document.getElementById('headerDate');
  const headerGreeting = document.getElementById('headerGreeting');
  const toast = document.getElementById('toast');

  async function updateHeader() {
    try {
      cachedProfile = await getProfile();
    } catch (_) {
      const user = await getUser();
      cachedProfile = user
        ? {
            loggedIn: true,
            displayName: getLocalDisplayName() || user.email?.split('@')[0] || '',
            email: user.email,
          }
        : { displayName: '', loggedIn: false };
    }

    headerGreeting.textContent = getGreeting(cachedProfile.displayName);
    const authBtn = document.getElementById('headerAuthBtn');
    if (authBtn) {
      authBtn.hidden = Boolean(cachedProfile.loggedIn);
    }
    if (cachedProfile.topup_balance != null) {
      syncTopUpFromCloud(cachedProfile.topup_balance);
    }
    if (cachedProfile.loggedIn) {
      syncScanStateFromProfile(cachedProfile);
    }

    const viewTitles = {
      today: '',
      log: 'Log a meal',
      reports: 'Your reports',
      settings: 'Goals & settings',
    };
    const viewSub = viewTitles[currentView] || '';

    const parts = [
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    ];
    if (viewSub) parts.unshift(viewSub);
    if (isPro() && currentView === 'today') parts.push(planLabel());
    headerDate.textContent = parts.filter(Boolean).join(' · ');
  }

  function showToast(msg, ms = 3200) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, ms);
  }

  function setView(view) {
    if (currentView === 'log' && view !== 'log' && isLogBusy()) {
      const leave = window.confirm('Leave meal logging? Tap Log again to continue where you left off.');
      if (!leave) return;
    }
    currentView = view;
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle('active', active);
      btn.toggleAttribute('aria-current', active ? 'page' : false);
    });
    refresh();
  }

  async function handleUpgrade() {
    setSettingsTab('plans');
    setView('settings');
  }

  function openSignIn(mode = 'signup') {
    openAuthModal({ mode, showToast, onSuccess: refresh });
  }

  function openSettings(tab, opts) {
    if (tab) setSettingsTab(tab, opts);
    setView('settings');
  }

  async function refresh() {
    main.setAttribute('aria-busy', 'true');
    try {
      await updateHeader();
      const profile = cachedProfile || await getProfile();
      if (currentView === 'today') {
        await renderToday(main, {
          onLog: () => setView('log'),
          onRefresh: refresh,
          onReports: () => setView('reports'),
          onSettings: openSettings,
          onSignIn: openSignIn,
          profile,
        });
        if (shouldShowOnboarding()) {
          await openOnboardingWizard({ onComplete: () => refresh() });
        }
      } else if (currentView === 'log') {
        renderLog(main, {
          onSaved: () => setView('today'),
          onCancel: () => setView('today'),
          showToast,
          onUpgrade: handleUpgrade,
          onSignIn: () => openSignIn('signin'),
          profile,
        });
      } else if (currentView === 'reports') {
        await renderReports(main, { profile, onLog: () => setView('log') });
      } else if (currentView === 'settings') {
        await renderSettings(main, {
          onSave: refresh,
          onGoToday: () => setView('today'),
          showToast,
          profile,
        });
      }
    } finally {
      main.removeAttribute('aria-busy');
    }
  }

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  document.querySelectorAll('[data-legal]').forEach((btn) => {
    btn.addEventListener('click', () => openLegalModal(btn.dataset.legal));
  });

  document.getElementById('headerAuthBtn')?.addEventListener('click', () => openSignIn('signin'));

  onAuthChange(async (session, event) => {
    if (event === 'PASSWORD_RECOVERY') {
      setPasswordResetMode(true);
      setSettingsTab('account');
      setView('settings');
    }
    if (session && isSupabaseConfigured()) {
      try {
        const result = await fullSync();
        if (result.plan) setPlan(result.plan);
      } catch (_) {}
    }
    refresh();
  });

  const initParams = new URLSearchParams(window.location.search);
  if (initParams.get('reset') === '1') {
    setPasswordResetMode(true);
    setSettingsTab('account');
  }

  handleCheckoutReturn().finally(async () => {
    await runNotificationChecks();
    const url = new URL(window.location.href);
    const view = url.searchParams.get('view');
    if (view === 'reports' || view === 'settings' || view === 'log' || view === 'today') {
      url.searchParams.delete('view');
      window.history.replaceState({}, '', url.pathname + url.search);
      setView(view);
    } else {
      refresh();
    }
  });
}

async function runNotificationChecks() {
  try {
    const end = todayKey();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekMeals = await getMealsInRange(weekStart.toISOString().slice(0, 10), end);
    const todayMeals = await getMealsForDate(end);
    const cuisineTips = weekMeals.length ? await getCuisineTips(weekMeals) : null;
    const profile = await getProfile();
    await runPersonalisedNotificationCheck(weekMeals, todayMeals, cuisineTips, profile.displayName);
  } catch (_) {}
}

async function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') !== 'success') return;

  const sessionId = params.get('session_id');
  const toast = document.getElementById('toast');
  if (sessionId) {
    try {
      const result = await verifyCheckoutSession(sessionId);
      if (result?.type === 'topup') {
        if (toast) {
          toast.textContent = `+${result.scans || 100} meal logs added to your account`;
          toast.hidden = false;
        }
      } else if (result?.plan) {
        setPlan(result.plan);
        if (toast) {
          toast.textContent = 'Subscription active — thank you!';
          toast.hidden = false;
        }
      }
    } catch (err) {
      if (toast) {
        toast.textContent = err?.message || 'Could not verify payment — contact support if you were charged';
        toast.hidden = false;
      }
    }
  } else if (toast) {
    toast.textContent =
      'Payment received! If your plan did not update, open Goals → Plans and tap Sync after signing in.';
    toast.hidden = false;
    try {
      const profile = await getProfile();
      if (profile.loggedIn) {
        const result = await fullSync();
        if (result?.plan) setPlan(result.plan);
      }
    } catch (_) {}
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('checkout');
  url.searchParams.delete('session_id');
  window.history.replaceState({}, '', url.pathname + url.search);
}
