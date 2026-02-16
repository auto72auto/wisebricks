export const REVIEW_MAP = {
  "75325": {
    title: "The Mandalorian's N-1 Starfighter",
    summary: "Compact Star Wars build with strong display appeal and broad fan interest, especially when priced below RRP.",
    href: "./reviews/75325-the-mandalorians-n-1-starfighter.html",
  },
  "75333": {
    title: "Obi-Wan Kenobi's Jedi Starfighter",
    summary: "Character-led set with solid shelf presence and value mostly tied to minifigure and franchise demand.",
    href: "./reviews/75333-obi-wan-kenobis-jedi-starfighter.html",
  },
  "75337": {
    title: "AT-TE Walker",
    summary: "Strong army-building appeal and play/display balance, with value improving materially during deeper discounts.",
    href: "./reviews/75337-at-te-walker.html",
  },
  "75345": {
    title: "501st Clone Troopers Battle Pack",
    summary: "High-liquidity troop pack that tends to perform best as a volume buy near major promotional windows.",
    href: "./reviews/75345-501st-clone-troopers-battle-pack.html",
  },
  "75347": {
    title: "TIE Bomber",
    summary: "Iconic ship choice with collector crossover demand; strongest buy case appears once discounts consistently hold.",
    href: "./reviews/75347-tie-bomber.html",
  },
  "75349": {
    title: "Captain Rex Helmet",
    summary: "Display-oriented helmet build where value is driven by character popularity and clean presentation quality.",
    href: "./reviews/75349-captain-rex-helmet.html",
  },
  "75356": {
    title: "Executor Super Star Destroyer",
    summary: "Small-footprint collector model with premium branding pull; value case improves with moderate markdowns.",
    href: "./reviews/75356-executor-super-star-destroyer.html",
  },
  "75388": {
    title: "Jedi Bob's Starfighter",
    summary: "Novelty and character nostalgia support demand, but pricing discipline remains key for long-term value.",
    href: "./reviews/75388-jedi-bobs-starfighter.html",
  },
  "75391": {
    title: "Captain Rex Y-Wing Microfighter",
    summary: "Low-price entry set with character-led upside; best positioned when acquired near promo-level pricing.",
    href: "./reviews/75391-captain-rex-y-wing-microfighter.html",
  },
  "75401": {
    title: "Ahsoka's Jedi Interceptor",
    summary: "Franchise-relevant starfighter set with stable interest; discount depth is the main driver of value score.",
    href: "./reviews/75401-ahsokas-jedi-interceptor.html",
  },
  "75404": {
    title: "Acclamator-Class Assault Ship",
    summary: "Fleet-display focused build with niche appeal; risk/reward profile improves when bought below median market prices.",
    href: "./reviews/75404-acclamator-class-assault-ship.html",
  },
  "75405": {
    title: "Home One Starcruiser",
    summary: "Collector-centric Rebel capital ship with stronger upside for patient buyers targeting sale cycles.",
    href: "./reviews/75405-home-one-starcruiser.html",
  },
};

export function getReviewForSet(setNumber) {
  return REVIEW_MAP[String(setNumber || "").trim()] || null;
}
