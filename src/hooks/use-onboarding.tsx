const WIZARD_KEY = "voxai.onboarding.wizard";
const TOUR_KEY = "voxai.onboarding.tour";

function get(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function set(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

export const onboardingState = {
  markNewUser() { set(WIZARD_KEY, "pending"); },
  isWizardPending() { return get(WIZARD_KEY) === "pending"; },
  completeWizard() { set(WIZARD_KEY, "done"); set(TOUR_KEY, "pending"); },
  isTourPending() { return get(TOUR_KEY) === "pending"; },
  completeTour() { set(TOUR_KEY, "done"); },
};
