const FEATURES = {
  authentication: {
    title: 'Real login and role security',
    description: 'Live accounts, secure sign-in, multi-factor authentication and server-enforced permissions need a connected backend.',
    simulation: 'This demo is using Helen Foster’s local Super admin view. Role switching here changes the interface only.'
  },
  payments: {
    title: 'Payment gateway',
    description: 'Card payments and Direct Debit need a payment provider such as Stripe or GoCardless, plus secure server-side payment handling.',
    simulation: 'A simulated payment journey is available in the Rent and Payments screen when that feature is built.'
  },
  ai: {
    title: 'Real AI services',
    description: 'Document extraction, payment matching and live-data chat need a configured AI service and a review step before any change is saved.',
    simulation: 'Demo suggestions must be reviewed and confirmed by a person; they do not change records on their own.'
  },
  banking: {
    title: 'Open Banking / ANNA feed',
    description: 'A live bank feed needs an authorised Open Banking connection, secure token handling and provider consent.',
    simulation: 'The bank statement records on this dashboard are sample data and are not connected to a bank.'
  },
  notifications: {
    title: 'Email, SMS and push delivery',
    description: 'Sending messages outside the app needs a delivery provider, verified sender details, consent and delivery monitoring.',
    simulation: 'In-app notifications are shown from the local demo dataset; no external message has been sent.'
  },
  signatures: {
    title: 'Electronic signatures',
    description: 'Legally managed e-signatures need an integrated signing provider, identity checks and an auditable document workflow.',
    simulation: 'Contract statuses shown in the demo are sample records and do not represent a legally signed agreement.'
  },
  storage: {
    title: 'Secure file storage',
    description: 'Real document uploads need encrypted, access-controlled file storage rather than a static site or browser-only metadata.',
    simulation: 'The demo stores file names and metadata only; it does not upload files to secure storage.'
  },
  scheduledJobs: {
    title: 'Scheduled reminders and checks',
    description: 'Automatic reminders, expiry checks and overdue processing require a server-side scheduler.',
    simulation: 'Statuses on this screen are calculated from the configured demo date; no scheduled job has run.'
  }
};

let modal;
let modalTitle;
let modalDescription;
let modalResult;
let simulateButton;

export function createNeedsLiveBadge(feature = 'authentication', label = 'Needs live system') {
  if (!FEATURES[feature]) {
    throw new Error(`Unknown live-system feature: ${feature}`);
  }

  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'btn live-badge';
  badge.dataset.liveFeature = feature;
  badge.setAttribute('aria-label', `${label}: ${FEATURES[feature].title}`);
  const icon = document.createElement('i');
  icon.className = 'bi bi-info-circle';
  icon.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = label;
  badge.append(icon, text);
  return badge;
}

export function initializeNeedsLiveSystemModal() {
  if (modal) return;

  const markup = `
    <div class="modal fade" id="needsLiveSystemModal" tabindex="-1" aria-labelledby="needsLiveSystemTitle" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 rounded-4">
          <div class="modal-header border-0 pb-0">
            <div>
              <span class="live-badge mb-2"><i class="bi bi-info-circle" aria-hidden="true"></i> Needs live system</span>
              <h2 class="modal-title fs-5" id="needsLiveSystemTitle"></h2>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body pt-2">
            <p id="needsLiveSystemDescription" class="text-secondary small"></p>
            <div id="needsLiveSystemResult" class="live-result" role="status" aria-live="polite"></div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-forest" id="simulateLiveFeature">Show demo result</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', markup);

  const modalElement = document.querySelector('#needsLiveSystemModal');
  modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);
  modalTitle = modalElement.querySelector('#needsLiveSystemTitle');
  modalDescription = modalElement.querySelector('#needsLiveSystemDescription');
  modalResult = modalElement.querySelector('#needsLiveSystemResult');
  simulateButton = modalElement.querySelector('#simulateLiveFeature');

  document.addEventListener('click', (event) => {
    const badge = event.target.closest('[data-live-feature]');
    if (!badge) return;

    const feature = FEATURES[badge.dataset.liveFeature];
    if (!feature) return;
    modalTitle.textContent = feature.title;
    modalDescription.textContent = feature.description;
    modalResult.textContent = '';
    simulateButton.dataset.simulation = feature.simulation;
    modal.show();
  });

  simulateButton.addEventListener('click', () => {
    modalResult.textContent = simulateButton.dataset.simulation || 'This feature is not connected in the demo.';
  });
}

export { FEATURES };
