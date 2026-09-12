import {
  loadLogView,
  loadTodayView,
  loadReportsView,
  loadCalendarView,
  loadSupplementsView,
} from './app-views.js';
import { isLogBusy } from './views/log-routing.js';
import { onAuthChange, getUser, isSupabaseConfigured } from './services/auth.js';
import { fullSync } from './services/sync.js';
import { verifyCheckoutSession, syncScanStateFromProfile } from './services/subscription.js';
import { getMealsInRange, getMealsForDate, todayKey } from './services/storage.js';
import { getCuisineTips } from './services/cuisine-tips.js';
import { runPersonalisedNotificationCheck } from './services/notifications.js';
import { getProfile, getGreeting, getLocalDisplayName } from './services/profile.js';
import { openLegalModal } from './views/legal.js';
import { openAuthModal } from './services/auth-modal.js';
import { shouldShowOnboarding, openOnboardingWizard } from './services/onboarding-wizard.js';
import {
  setSettingsTab,
  setPasswordResetMode,
  getTodayViewDate,
  setTodayViewDate,
  setLogTargetDate,
  clearLogTargetDate,
} from './views/app-nav-state.js';
import { APP_NAME, APP_TAGLINE } from './services/brand.js';

let currentView = 'today';
let cachedProfile = null;

export function initApp() {
  const main = document.getElementById('main');
  const headerDate = document.getElementById('headerDate');
  const headerGreeting = document.getElementById('headerGreeting');
  const toast = document.getElementById('toast');
  let siteHeaderScrollHandler = null;
  let guestStickyScrollHandler = null;

  function applyGuestShell(profile) {
    const isGuest = !profile?.loggedIn;
    document.documentElement.classList.toggle('is-guest', isGuest);

    const siteHeader = document.getElementById('siteHeader');
    const appHeader = document.querySelector('.app-header');
    const bottomNav = document.querySelector('.bottom-nav');
    const disclaimerStrip = document.querySelector('.app-disclaimer-strip');
    const sidebarGuest = document.getElementById('sidebarGuest');

    if (siteHeader) siteHeader.hidden = !isGuest;
    if (appHeader) appHeader.hidden = isGuest;
    if (bottomNav) bottomNav.hidden = isGuest;
    if (disclaimerStrip) disclaimerStrip.hidden = isGuest;
    if (sidebarGuest) sidebarGuest.hidden = !isGuest;

    headerGreeting.textContent = profile?.loggedIn
      ? getGreeting(profile.displayName)
      : `${APP_NAME} — ${APP_TAGLINE}`;

    if (headerDate) {
      if (isGuest) {
        headerDate.textContent = '';
      }
    }

    const authBtn = document.getElementById('headerAuthBtn');
    if (authBtn) {
      authBtn.hidden = Boolean(profile?.loggedIn) || currentView === 'today';
      authBtn.textContent = 'Sign in';
    }
  }

  function bindSiteHeaderUi() {
    const header = document.getElementById('siteHeader');
    if (siteHeaderScrollHandler) {
      window.removeEventListener('scroll', siteHeaderScrollHandler);
      siteHeaderScrollHandler = null;
    }
    if (header && !header.hidden) {
      siteHeaderScrollHandler = () => {
        header.classList.toggle('site-header--scrolled', window.scrollY > 8);
      };
      window.addEventListener('scroll', siteHeaderScrollHandler, { passive: true });
      siteHeaderScrollHandler();
    }
  }

  function bindGuestStickyCta() {
    const bar = document.getElementById('guestStickyCta');
    if (!bar) return;
    const isGuest = document.documentElement.classList.contains('is-guest');
    const showBar = isGuest && currentView === 'today';
    bar.hidden = !showBar;
    if (guestStickyScrollHandler) {
      window.removeEventListener('scroll', guestStickyScrollHandler);
      guestStickyScrollHandler = null;
    }
    if (!showBar) {
      bar.classList.remove('guest-sticky-cta--visible');
      return;
    }
    const hero = main.querySelector('.landing-hero-v2, .landing-hero, .welcome-panel');
    if (!hero) return;
    guestStickyScrollHandler = () => {
      const pastHero = hero.getBoundingClientRect().bottom < 72;
      bar.classList.toggle('guest-sticky-cta--visible', pastHero);
    };
    window.addEventListener('scroll', guestStickyScrollHandler, { passive: true });
    guestStickyScrollHandler();
  }

  function scrollToLandingSection(sectionId) {
    const scroll = () => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (currentView !== 'today') {
      setView('today');
      window.setTimeout(scroll, 120);
    } else {
      scroll();
    }
  }

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

    applyGuestShell(cachedProfile);

    if (cachedProfile.loggedIn) {
      syncScanStateFromProfile(cachedProfile);
    }

    if (cachedProfile.loggedIn) {
      const viewTitles = {
        today: '',
        log: 'Log a meal',
        supplements: 'Supplement log',
        calendar: 'Meal calendar',
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
      headerDate.textContent = parts.filter(Boolean).join(' · ');
    }
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
    refresh().then(() => focusMainHeading());
  }

  function focusMainHeading() {
    if (document.documentElement.classList.contains('is-guest')) return;
    const heading = main.querySelector('h1, h2');
    if (!(heading instanceof HTMLElement)) return;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    try { heading.focus(); } catch (_) {}
  }

  function handleUpgrade() {
    setSettingsTab('plans');
    setView('settings');
  }

  function openSignIn(mode = 'signin') {
    openAuthModal({ mode, showToast, onSuccess: refresh });
  }

  function openSettings(tab) {
    if (tab) setSettingsTab(tab);
    setView('settings');
  }

  function goLog(focus) {
    if (focus === 'photo' || focus === 'barcode' || focus === 'describe' || focus === 'search' || focus === 'upload') {
      import('./views/log-routing.js').then(({ requestLogFocus }) => {
        requestLogFocus(focus);
        setView('log');
      });
      return;
    }
    setView('log');
  }

  async function refresh() {
    main.setAttribute('aria-busy', 'true');
    try {
      await updateHeader();
      const profile = cachedProfile || await getProfile();
      if (currentView === 'today') {
        const { renderToday } = await loadTodayView();
        await renderToday(main, {
          onLog: goLog,
          onRefresh: refresh,
          onReports: () => setView('reports'),
          onSettings: openSettings,
          onSupplements: () => setView('supplements'),
          onCalendar: async () => {
            const calendar = await loadCalendarView();
            const dk = getTodayViewDate();
            if (dk) calendar.openCalendarOnDate(dk);
            setView('calendar');
          },
          onSignIn: openSignIn,
          profile,
        });
        if (shouldShowOnboarding({ loggedIn: profile?.loggedIn })) {
          await openOnboardingWizard({ onComplete: () => refresh() });
        }
      } else if (currentView === 'log') {
        const { renderLog } = await loadLogView();
        renderLog(main, {
          onSaved: () => {
            clearLogTargetDate();
            setView('today');
          },
          onCancel: () => {
            clearLogTargetDate();
            setView('today');
          },
          showToast,
          onUpgrade: handleUpgrade,
          onSignIn: () => openSignIn('signin'),
          profile,
        });
      } else if (currentView === 'supplements') {
        const supplements = await loadSupplementsView();
        await supplements.renderSupplements(main, {
          profile,
          showToast,
          onRefresh: refresh,
          onSignIn: openSignIn,
        });
      } else if (currentView === 'calendar') {
        const calendar = await loadCalendarView();
        await calendar.renderCalendar(main, {
          profile,
          onBack: () => setView('today'),
          onViewDay: (dateKey) => {
            setTodayViewDate(dateKey);
            setView('today');
          },
          onLogForDate: (dateKey) => {
            setTodayViewDate(dateKey);
            setLogTargetDate(dateKey);
            setView('log');
          },
          onSignIn: openSignIn,
        });
      } else if (currentView === 'reports') {
        const { renderReports } = await loadReportsView();
        await renderReports(main, {
          profile,
          onLog: goLog,
          onUpgrade: handleUpgrade,
          onOpenDay: (dateKey) => {
            setTodayViewDate(dateKey);
            setView('today');
          },
          onOpenCalendar: async () => {
            const calendar = await loadCalendarView();
            calendar.openCalendarOnDate(getTodayViewDate() || todayKey());
            setView('calendar');
          },
          onSignIn: openSignIn,
        });
      } else if (currentView === 'settings') {
        const todayMod = await loadTodayView();
        await todayMod.renderSettings(main, {
          onSave: refresh,
          onGoToday: () => setView('today'),
          showToast,
          profile,
          onSignIn: openSignIn,
        });
      }
    } catch (err) {
      console.error(err);
      main.innerHTML = `
        <div class="view-page view-page--boot">
          <p class="app-boot__title">Couldn’t load this page</p>
          <p class="app-boot__lead">Please try again. If it stays blank, refresh the browser.</p>
          <button type="button" class="btn btn-primary" id="retryBoot">Try again</button>
        </div>
      `;
      main.querySelector('#retryBoot')?.addEventListener('click', () => refresh());
    } finally {
      main.removeAttribute('aria-busy');
      bindGuestStickyCta();
      bindSiteHeaderUi();
    }
  }

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'supplements') {
        loadSupplementsView().then((mod) => mod.clearSupplementsViewDate()).catch(() => {});
      }
      setView(btn.dataset.view);
    });
  });

  document.querySelectorAll('[data-legal]').forEach((btn) => {
    btn.addEventListener('click', () => openLegalModal(btn.dataset.legal));
  });

  document.getElementById('headerAuthBtn')?.addEventListener('click', () => openSignIn('signin'));
  document.getElementById('guestStickySignup')?.addEventListener('click', () => openSignIn('signup'));
  document.getElementById('guestStickySignIn')?.addEventListener('click', () => openSignIn('signin'));
  document.getElementById('siteHeaderHome')?.addEventListener('click', (e) => {
    e.preventDefault();
    setView('today');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('siteHeaderSignIn')?.addEventListener('click', () => openSignIn('signin'));
  document.getElementById('siteHeaderTryFree')?.addEventListener('click', () => openSignIn('signup'));
  document.getElementById('siteHeaderMenuBtn')?.addEventListener('click', () => {
    const nav = document.getElementById('siteHeaderNav');
    const menuBtn = document.getElementById('siteHeaderMenuBtn');
    const open = nav?.classList.toggle('site-header__nav--open');
    menuBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.querySelectorAll('[data-site-anchor]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('siteHeaderNav')?.classList.remove('site-header__nav--open');
      document.getElementById('siteHeaderMenuBtn')?.setAttribute('aria-expanded', 'false');
      scrollToLandingSection(link.dataset.siteAnchor);
    });
  });
  document.getElementById('sidebarGetStarted')?.addEventListener('click', () => openSignIn('signup'));
  document.getElementById('sidebarSignIn')?.addEventListener('click', () => openSignIn('signin'));

  onAuthChange(async (session, event) => {
    if (event === 'PASSWORD_RECOVERY') {
      setPasswordResetMode(true);
      setSettingsTab('account');
      setView('settings');
    }
    if (session && isSupabaseConfigured()) {
      try {
        await fullSync();
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
    if (view === 'reports' || view === 'settings' || view === 'log' || view === 'today' || view === 'supplements' || view === 'calendar') {
      url.searchParams.delete('view');
      window.history.replaceState({}, '', url.pathname + url.search);
      setView(view);
    } else {
      refresh();
    }
  });
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
          toast.textContent = `+${result.scans || 100} top-up credits added`;
          toast.hidden = false;
        }
        const profile = await getProfile();
        if (profile.loggedIn) syncScanStateFromProfile(profile);
      }
    } catch (err) {
      if (toast) {
        toast.textContent = err?.message || 'Could not verify payment — contact support if you were charged';
        toast.hidden = false;
      }
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('checkout');
  url.searchParams.delete('session_id');
  window.history.replaceState({}, '', url.pathname + url.search);
}

async function runNotificationChecks() {
  try {
    const end = todayKey();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    const weekMeals = await getMealsInRange(todayKey(weekStart), end);
    const todayMeals = await getMealsForDate(end);
    const cuisineTips = weekMeals.length ? await getCuisineTips(weekMeals) : null;
    const profile = await getProfile();
    await runPersonalisedNotificationCheck(weekMeals, todayMeals, cuisineTips, profile.displayName);
  } catch (_) {}
}
