import './map-legacy-ownership-core.mjs';
import { promoteHtmlScreenSources } from './promote-html-screen-sources.mjs';

// SC-031 structural source promotion entrypoint: screens + setup/player modal bank.
// Current acceptance also hardens the canonical two-game Leaderboard journey before ownership promotion.
promoteHtmlScreenSources();
