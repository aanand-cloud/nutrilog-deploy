import { CONTROLLER_NAME, LEGAL_VERSION, SUPPORT_EMAIL } from '../services/legal-constants.js';

const PRIVACY_HTML = `
  <h2>Privacy policy</h2>
  <p><strong>Last updated:</strong> July 2026 · Version ${LEGAL_VERSION}</p>
  <p>NutriLog helps you track meals using photos, barcodes, and your own notes. This policy explains who we are, what we collect, why, and your rights.</p>

  <h3>Who we are (data controller)</h3>
  <p><strong>${CONTROLLER_NAME}</strong> operates NutriLog. For privacy questions or to exercise your rights, contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>

  <h3>What we collect</h3>
  <ul>
    <li><strong>Account:</strong> email, first name, password (hashed by Supabase Auth).</li>
    <li><strong>Meals &amp; nutrition:</strong> photos you choose to log, AI estimates, calories, macros, meal notes, dates, and barcode/search results for packaged food.</li>
    <li><strong>Goals &amp; preferences:</strong> calorie targets, macros, units, notification settings.</li>
    <li><strong>On-device profile:</strong> age, height, weight, and activity used to suggest goals (stored on your device unless you sync goals to the cloud).</li>
    <li><strong>Billing:</strong> subscription status and Stripe customer ID (we do not store full card numbers).</li>
    <li><strong>Discount eligibility:</strong> optional NHS/work email or self-declared 60+ status for pricing.</li>
    <li><strong>Push notifications:</strong> device push endpoint and keys, only if you opt in.</li>
  </ul>

  <h3>Health-related data</h3>
  <p>Meal logs and nutrition goals may reveal information about your diet and lifestyle. NutriLog is a <strong>wellness tool only</strong> — not a medical device or clinical service. Do not use it to diagnose or treat health conditions. Where required by law, we rely on your <strong>explicit consent</strong> before AI processing of meal photos and summaries.</p>

  <h3>Why we use your data (lawful bases)</h3>
  <ul>
    <li><strong>Contract:</strong> to provide your account, sync meals, and manage subscriptions you request.</li>
    <li><strong>Consent:</strong> AI photo analysis, personalised coaching tips, push notifications, and optional discount verification.</li>
    <li><strong>Legitimate interests:</strong> security, fraud prevention, and improving the service (balanced against your rights).</li>
    <li><strong>Legal obligation:</strong> tax, accounting, or requests from authorities where applicable.</li>
  </ul>

  <h3>AI &amp; third-party processors</h3>
  <ul>
    <li><strong>Google Gemini:</strong> meal photos and meal summaries for nutrition estimates and coaching tips. Do not log sensitive documents in photos.</li>
    <li><strong>Open Food Facts:</strong> barcode and product name search for packaged food (no photo sent).</li>
    <li><strong>Supabase:</strong> authentication, database, and private photo storage (region depends on your project settings).</li>
    <li><strong>Stripe:</strong> secure payments and subscription billing.</li>
    <li><strong>Vercel / Netlify:</strong> website hosting and serverless API functions.</li>
    <li><strong>Google Fonts:</strong> web fonts loaded from Google’s CDN when you use the website.</li>
  </ul>
  <p>We use written data processing agreements with our processors where required. We do <strong>not</strong> sell your personal information.</p>

  <h3>International transfers</h3>
  <p>Some processors (including Google and Stripe) may process data in the United States or other countries outside your own. Where required, we rely on appropriate safeguards such as Standard Contractual Clauses or equivalent mechanisms offered by those providers.</p>

  <h3>Retention</h3>
  <ul>
    <li>Account and cloud meal data: kept while your account is active.</li>
    <li>After you delete your account: we delete your profile, meals, and cloud photos within a reasonable period (typically within 30 days).</li>
    <li>Billing records: retained as required for tax and accounting (via Stripe).</li>
    <li>Local data on your device: you can clear this by deleting meals or signing out and clearing browser/app storage.</li>
  </ul>

  <h3>Your rights</h3>
  <p>Depending on where you live (including UK, EEA, and California), you may have the right to:</p>
  <ul>
    <li><strong>Access</strong> and receive a copy of your data (Settings → Download my data).</li>
    <li><strong>Correct</strong> inaccurate data in the app.</li>
    <li><strong>Delete</strong> your account and cloud data (Settings → Delete my account).</li>
    <li><strong>Export</strong> your meals (JSON or CSV).</li>
    <li><strong>Withdraw consent</strong> for AI processing or notifications at any time (stop using AI logging or turn off notifications).</li>
    <li><strong>Object or restrict</strong> certain processing where applicable.</li>
    <li><strong>Complain</strong> to your local data protection authority (e.g. ICO in the UK).</li>
  </ul>
  <p><strong>California (CCPA/CPRA):</strong> We do not sell or share personal information for cross-context behavioural advertising. You may request deletion or a copy of personal information using the tools above or by emailing ${SUPPORT_EMAIL}.</p>

  <h3>Children</h3>
  <p>NutriLog is for users aged <strong>16 and over</strong>. We do not knowingly collect data from children under 16.</p>

  <h3>Contact</h3>
  <p>Privacy questions or rights requests: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>

  <p class="fine-print"><strong>Not medical advice.</strong> NutriLog provides estimates only. Speak to your GP or a registered dietitian for health concerns.</p>
`;

const TERMS_HTML = `
  <h2>Terms of use</h2>
  <p><strong>Last updated:</strong> July 2026 · Version ${LEGAL_VERSION}</p>

  <h3>Agreement</h3>
  <p>By creating an account or using NutriLog, you agree to these Terms and our Privacy policy. You must be at least <strong>16 years old</strong>.</p>

  <h3>Wellness tool only</h3>
  <p>NutriLog gives AI-powered <em>estimates</em>, not laboratory nutrition analysis or medical advice. Always check food labels when accuracy matters.</p>

  <h3>Your account</h3>
  <ul>
    <li>Keep your password private.</li>
    <li>One person per account — do not share login details.</li>
    <li>Provide accurate information when creating an account or claiming discounts.</li>
    <li>Do not attempt to bypass meal-log limits or abuse free or paid allowances.</li>
    <li>You may delete your account at any time in Settings.</li>
  </ul>

  <h3>Subscriptions</h3>
  <ul>
    <li>Paid plans and top-ups are billed monthly via Stripe.</li>
    <li>Meal-log allowances reset as shown in the app (daily for free, monthly for paid).</li>
    <li>You can <strong>cancel or change your plan anytime</strong> in Goals → Plans → <em>Billing &amp; subscription</em> → <em>Cancel or change plan</em> (Stripe billing portal).</li>
    <li>If you cancel, you keep access until the end of your current billing period, then return to the free plan.</li>
    <li>Refunds follow Stripe and applicable consumer law.</li>
  </ul>

  <h3>NHS &amp; public sector discount</h3>
  <p>NutriLog is <strong>not affiliated with the NHS</strong>. Discounts are offered to eligible public-sector staff and over-60s who accurately declare eligibility.</p>

  <h3>Acceptable use</h3>
  <p>Do not upload illegal content, harass others, or automate abuse of our APIs, barcode lookups, or food search.</p>

  <p class="fine-print"><strong>Not medical advice.</strong> NutriLog provides AI and database estimates only — not medical or dietary advice. Always check food labels when accuracy matters. Speak to your GP or a registered dietitian for health concerns.</p>
`;

export function openLegalModal(kind = 'privacy') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'camera-modal legal-modal';
    overlay.innerHTML = `
      <div class="camera-modal__panel legal-panel">
        <button type="button" class="legal-close" id="legalClose" aria-label="Close">✕</button>
        <div class="legal-body">${kind === 'terms' ? TERMS_HTML : PRIVACY_HTML}</div>
        <div class="camera-modal__actions">
          <button type="button" class="btn btn-primary full" id="legalOk">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close() {
      overlay.remove();
      document.body.style.overflow = '';
      resolve();
    }

    overlay.querySelector('#legalClose').addEventListener('click', close);
    overlay.querySelector('#legalOk').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  });
}
