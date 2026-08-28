// Catholic dioceses / eparchies of Canada and the United States.
// Each entry carries the coordinates of its see city so events and organizers
// can be matched to the nearest jurisdiction, and so the map can recenter.

export type Diocese = {
  slug: string;
  name: string;
  nameFr?: string;
  city: string;
  country: "CA" | "US";
  /** Grouping key used for section headings in the picker. */
  group: string;
  lat: number;
  lng: number;
  /** National / personal jurisdictions are never auto-assigned by geography. */
  national?: boolean;
  /**
   * Set on synthetic "all dioceses in this city" entries: the real diocese
   * slugs the combined view covers. Undefined on real jurisdictions.
   */
  members?: string[];
  /** Optional override for the short header label. */
  shortLabel?: string;
};

const CA_ARCH = "ca-archdioceses";
const CA_DIO = "ca-dioceses";
const CA_EAST = "ca-eastern";

export const DIOCESES: Diocese[] = [
  // ── Canada — Latin archdioceses ─────────────────────────────────────────
  { slug: "edmonton", name: "Archdiocese of Edmonton", nameFr: "Archidiocèse d'Edmonton", city: "Edmonton, AB", country: "CA", group: CA_ARCH, lat: 53.5461, lng: -113.4938 },
  { slug: "gatineau", name: "Archdiocese of Gatineau", nameFr: "Archidiocèse de Gatineau", city: "Gatineau, QC", country: "CA", group: CA_ARCH, lat: 45.4765, lng: -75.7013 },
  { slug: "grouard-mclennan", name: "Archdiocese of Grouard–McLennan", city: "McLennan, AB", country: "CA", group: CA_ARCH, lat: 55.7, lng: -116.49 },
  { slug: "halifax-yarmouth", name: "Archdiocese of Halifax–Yarmouth", city: "Halifax, NS", country: "CA", group: CA_ARCH, lat: 44.6488, lng: -63.5752 },
  { slug: "keewatin-le-pas", name: "Archdiocese of Keewatin–Le Pas", city: "The Pas, MB", country: "CA", group: CA_ARCH, lat: 53.825, lng: -101.254 },
  { slug: "kingston", name: "Archdiocese of Kingston", city: "Kingston, ON", country: "CA", group: CA_ARCH, lat: 44.2312, lng: -76.486 },
  { slug: "moncton", name: "Archdiocese of Moncton", nameFr: "Archidiocèse de Moncton", city: "Moncton, NB", country: "CA", group: CA_ARCH, lat: 46.0878, lng: -64.7782 },
  { slug: "montreal", name: "Archdiocese of Montréal", nameFr: "Archidiocèse de Montréal", city: "Montréal, QC", country: "CA", group: CA_ARCH, lat: 45.5019, lng: -73.5674 },
  { slug: "ottawa-cornwall", name: "Archdiocese of Ottawa–Cornwall", nameFr: "Archidiocèse d'Ottawa–Cornwall", city: "Ottawa, ON", country: "CA", group: CA_ARCH, lat: 45.4215, lng: -75.6972 },
  { slug: "quebec", name: "Archdiocese of Québec", nameFr: "Archidiocèse de Québec", city: "Québec, QC", country: "CA", group: CA_ARCH, lat: 46.8139, lng: -71.208 },
  { slug: "regina", name: "Archdiocese of Regina", city: "Regina, SK", country: "CA", group: CA_ARCH, lat: 50.4452, lng: -104.6189 },
  { slug: "rimouski", name: "Archdiocese of Rimouski", nameFr: "Archidiocèse de Rimouski", city: "Rimouski, QC", country: "CA", group: CA_ARCH, lat: 48.4488, lng: -68.5236 },
  { slug: "saint-boniface", name: "Archdiocese of Saint-Boniface", nameFr: "Archidiocèse de Saint-Boniface", city: "Winnipeg, MB", country: "CA", group: CA_ARCH, lat: 49.8844, lng: -97.1189 },
  { slug: "st-johns-nl", name: "Archdiocese of Saint John's, Newfoundland", city: "St. John's, NL", country: "CA", group: CA_ARCH, lat: 47.5615, lng: -52.7126 },
  { slug: "sherbrooke", name: "Archdiocese of Sherbrooke", nameFr: "Archidiocèse de Sherbrooke", city: "Sherbrooke, QC", country: "CA", group: CA_ARCH, lat: 45.4042, lng: -71.8929 },
  { slug: "toronto", name: "Archdiocese of Toronto", city: "Toronto, ON", country: "CA", group: CA_ARCH, lat: 43.6532, lng: -79.3832 },
  { slug: "vancouver", name: "Archdiocese of Vancouver", city: "Vancouver, BC", country: "CA", group: CA_ARCH, lat: 49.2827, lng: -123.1207 },
  { slug: "winnipeg", name: "Archdiocese of Winnipeg", city: "Winnipeg, MB", country: "CA", group: CA_ARCH, lat: 49.8951, lng: -97.1384 },

  // ── Canada — Latin dioceses ─────────────────────────────────────────────
  { slug: "amos", name: "Diocese of Amos", nameFr: "Diocèse d'Amos", city: "Amos, QC", country: "CA", group: CA_DIO, lat: 48.5667, lng: -78.1167 },
  { slug: "antigonish", name: "Diocese of Antigonish", city: "Antigonish, NS", country: "CA", group: CA_DIO, lat: 45.6167, lng: -61.9986 },
  { slug: "baie-comeau", name: "Diocese of Baie-Comeau", nameFr: "Diocèse de Baie-Comeau", city: "Baie-Comeau, QC", country: "CA", group: CA_DIO, lat: 49.2167, lng: -68.15 },
  { slug: "bathurst", name: "Diocese of Bathurst", nameFr: "Diocèse de Bathurst", city: "Bathurst, NB", country: "CA", group: CA_DIO, lat: 47.6186, lng: -65.6512 },
  { slug: "calgary", name: "Diocese of Calgary", city: "Calgary, AB", country: "CA", group: CA_DIO, lat: 51.0447, lng: -114.0719 },
  { slug: "charlottetown", name: "Diocese of Charlottetown", city: "Charlottetown, PE", country: "CA", group: CA_DIO, lat: 46.2382, lng: -63.1311 },
  { slug: "chicoutimi", name: "Diocese of Chicoutimi", nameFr: "Diocèse de Chicoutimi", city: "Saguenay, QC", country: "CA", group: CA_DIO, lat: 48.4283, lng: -71.0687 },
  { slug: "churchill-hudson-bay", name: "Diocese of Churchill–Baie d'Hudson", city: "Churchill, MB", country: "CA", group: CA_DIO, lat: 58.7684, lng: -94.165 },
  { slug: "corner-brook-labrador", name: "Diocese of Corner Brook and Labrador", city: "Corner Brook, NL", country: "CA", group: CA_DIO, lat: 48.9509, lng: -57.9522 },
  { slug: "edmundston", name: "Diocese of Edmundston", nameFr: "Diocèse d'Edmundston", city: "Edmundston, NB", country: "CA", group: CA_DIO, lat: 47.3737, lng: -68.325 },
  { slug: "gaspe", name: "Diocese of Gaspé", nameFr: "Diocèse de Gaspé", city: "Gaspé, QC", country: "CA", group: CA_DIO, lat: 48.8319, lng: -64.4869 },
  { slug: "grand-falls", name: "Diocese of Grand Falls", city: "Grand Falls-Windsor, NL", country: "CA", group: CA_DIO, lat: 48.9333, lng: -55.6667 },
  { slug: "hamilton", name: "Diocese of Hamilton", city: "Hamilton, ON", country: "CA", group: CA_DIO, lat: 43.2557, lng: -79.8711 },
  { slug: "hearst-moosonee", name: "Diocese of Hearst–Moosonee", city: "Hearst, ON", country: "CA", group: CA_DIO, lat: 49.6853, lng: -83.6667 },
  { slug: "joliette", name: "Diocese of Joliette", nameFr: "Diocèse de Joliette", city: "Joliette, QC", country: "CA", group: CA_DIO, lat: 46.0167, lng: -73.4333 },
  { slug: "kamloops", name: "Diocese of Kamloops", city: "Kamloops, BC", country: "CA", group: CA_DIO, lat: 50.6745, lng: -120.3273 },
  { slug: "london", name: "Diocese of London", city: "London, ON", country: "CA", group: CA_DIO, lat: 42.9849, lng: -81.2453 },
  { slug: "mackenzie-fort-smith", name: "Diocese of Mackenzie–Fort Smith", city: "Fort Smith, NT", country: "CA", group: CA_DIO, lat: 60.0044, lng: -111.885 },
  { slug: "nelson", name: "Diocese of Nelson", city: "Nelson, BC", country: "CA", group: CA_DIO, lat: 49.4928, lng: -117.2948 },
  { slug: "nicolet", name: "Diocese of Nicolet", nameFr: "Diocèse de Nicolet", city: "Nicolet, QC", country: "CA", group: CA_DIO, lat: 46.2236, lng: -72.6167 },
  { slug: "pembroke", name: "Diocese of Pembroke", city: "Pembroke, ON", country: "CA", group: CA_DIO, lat: 45.8267, lng: -77.1117 },
  { slug: "peterborough", name: "Diocese of Peterborough", city: "Peterborough, ON", country: "CA", group: CA_DIO, lat: 44.3091, lng: -78.3197 },
  { slug: "prince-albert", name: "Diocese of Prince Albert", city: "Prince Albert, SK", country: "CA", group: CA_DIO, lat: 53.2033, lng: -105.7531 },
  { slug: "prince-george", name: "Diocese of Prince George", city: "Prince George, BC", country: "CA", group: CA_DIO, lat: 53.9171, lng: -122.7497 },
  { slug: "rouyn-noranda", name: "Diocese of Rouyn-Noranda", nameFr: "Diocèse de Rouyn-Noranda", city: "Rouyn-Noranda, QC", country: "CA", group: CA_DIO, lat: 48.2359, lng: -79.0232 },
  { slug: "saint-catharines", name: "Diocese of Saint Catharines", city: "St. Catharines, ON", country: "CA", group: CA_DIO, lat: 43.1594, lng: -79.2469 },
  { slug: "saint-hyacinthe", name: "Diocese of Saint-Hyacinthe", nameFr: "Diocèse de Saint-Hyacinthe", city: "Saint-Hyacinthe, QC", country: "CA", group: CA_DIO, lat: 45.6167, lng: -72.95 },
  { slug: "saint-jean-longueuil", name: "Diocese of Saint-Jean–Longueuil", nameFr: "Diocèse de Saint-Jean–Longueuil", city: "Longueuil, QC", country: "CA", group: CA_DIO, lat: 45.5312, lng: -73.5182 },
  { slug: "saint-jerome-mont-laurier", name: "Diocese of Saint-Jérôme–Mont-Laurier", nameFr: "Diocèse de Saint-Jérôme–Mont-Laurier", city: "Saint-Jérôme, QC", country: "CA", group: CA_DIO, lat: 45.78, lng: -74.0033 },
  { slug: "saint-john-nb", name: "Diocese of Saint John, New Brunswick", city: "Saint John, NB", country: "CA", group: CA_DIO, lat: 45.2733, lng: -66.0633 },
  { slug: "saint-paul-alberta", name: "Diocese of Saint-Paul in Alberta", city: "St. Paul, AB", country: "CA", group: CA_DIO, lat: 53.9928, lng: -111.2972 },
  { slug: "sainte-anne-de-la-pocatiere", name: "Diocese of Sainte-Anne-de-la-Pocatière", nameFr: "Diocèse de Sainte-Anne-de-la-Pocatière", city: "La Pocatière, QC", country: "CA", group: CA_DIO, lat: 47.3606, lng: -70.0281 },
  { slug: "saskatoon", name: "Diocese of Saskatoon", city: "Saskatoon, SK", country: "CA", group: CA_DIO, lat: 52.1332, lng: -106.67 },
  { slug: "sault-sainte-marie", name: "Diocese of Sault Sainte Marie", city: "Sault Ste. Marie, ON", country: "CA", group: CA_DIO, lat: 46.5136, lng: -84.3358 },
  { slug: "thunder-bay", name: "Diocese of Thunder Bay", city: "Thunder Bay, ON", country: "CA", group: CA_DIO, lat: 48.3809, lng: -89.2477 },
  { slug: "timmins", name: "Diocese of Timmins", nameFr: "Diocèse de Timmins", city: "Timmins, ON", country: "CA", group: CA_DIO, lat: 48.4758, lng: -81.3305 },
  { slug: "trois-rivieres", name: "Diocese of Trois-Rivières", nameFr: "Diocèse de Trois-Rivières", city: "Trois-Rivières, QC", country: "CA", group: CA_DIO, lat: 46.3432, lng: -72.5429 },
  { slug: "valleyfield", name: "Diocese of Valleyfield", nameFr: "Diocèse de Valleyfield", city: "Salaberry-de-Valleyfield, QC", country: "CA", group: CA_DIO, lat: 45.2501, lng: -74.1313 },
  { slug: "victoria-bc", name: "Diocese of Victoria", city: "Victoria, BC", country: "CA", group: CA_DIO, lat: 48.4284, lng: -123.3656 },
  { slug: "whitehorse", name: "Diocese of Whitehorse", city: "Whitehorse, YT", country: "CA", group: CA_DIO, lat: 60.7212, lng: -135.0568 },

  // ── Canada — Eastern Catholic & special jurisdictions ───────────────────
  { slug: "ukrainian-winnipeg", name: "Ukrainian Catholic Archdiocese of Winnipeg", city: "Winnipeg, MB", country: "CA", group: CA_EAST, lat: 49.8951, lng: -97.1384, national: true },
  { slug: "ukrainian-edmonton", name: "Ukrainian Catholic Eparchy of Edmonton", city: "Edmonton, AB", country: "CA", group: CA_EAST, lat: 53.5461, lng: -113.4938, national: true },
  { slug: "ukrainian-new-westminster", name: "Ukrainian Catholic Eparchy of New Westminster", city: "New Westminster, BC", country: "CA", group: CA_EAST, lat: 49.2057, lng: -122.911, national: true },
  { slug: "ukrainian-saskatoon", name: "Ukrainian Catholic Eparchy of Saskatoon", city: "Saskatoon, SK", country: "CA", group: CA_EAST, lat: 52.1332, lng: -106.67, national: true },
  { slug: "ukrainian-toronto", name: "Ukrainian Catholic Eparchy of Toronto", city: "Toronto, ON", country: "CA", group: CA_EAST, lat: 43.6532, lng: -79.3832, national: true },
  { slug: "chaldean-mar-addai-toronto", name: "Chaldean Catholic Diocese of Mar Addai of Toronto", city: "Toronto, ON", country: "CA", group: CA_EAST, lat: 43.6532, lng: -79.3832, national: true },
  { slug: "syro-malabar-mississauga", name: "Syro-Malabar Catholic Diocese of Mississauga", city: "Mississauga, ON", country: "CA", group: CA_EAST, lat: 43.589, lng: -79.6441, national: true },
  { slug: "maronite-montreal", name: "Maronite Catholic Eparchy of Saint-Maron of Montréal", city: "Montréal, QC", country: "CA", group: CA_EAST, lat: 45.5019, lng: -73.5674, national: true },
  { slug: "melkite-montreal", name: "Greek-Melkite Catholic Eparchy of Saint-Sauveur of Montréal", city: "Montréal, QC", country: "CA", group: CA_EAST, lat: 45.5019, lng: -73.5674, national: true },
  { slug: "ruthenian-toronto", name: "Apostolic Exarchate of Saints Cyril and Methodius of Toronto", city: "Toronto, ON", country: "CA", group: CA_EAST, lat: 43.6532, lng: -79.3832, national: true },
  { slug: "syriac-canada", name: "Syriac Catholic Apostolic Exarchate of Canada", city: "Montréal, QC", country: "CA", group: CA_EAST, lat: 45.5019, lng: -73.5674, national: true },
  { slug: "military-ordinariate-canada", name: "Military Ordinariate of Canada", city: "Ottawa, ON", country: "CA", group: CA_EAST, lat: 45.4215, lng: -75.6972, national: true },

  // ── United States — Region I: New England ───────────────────────────────
  { slug: "boston", name: "Archdiocese of Boston", city: "Boston, MA", country: "US", group: "us-1", lat: 42.3601, lng: -71.0589 },
  { slug: "bridgeport", name: "Diocese of Bridgeport", city: "Bridgeport, CT", country: "US", group: "us-1", lat: 41.1865, lng: -73.1952 },
  { slug: "burlington", name: "Diocese of Burlington", city: "Burlington, VT", country: "US", group: "us-1", lat: 44.4759, lng: -73.2121 },
  { slug: "fall-river", name: "Diocese of Fall River", city: "Fall River, MA", country: "US", group: "us-1", lat: 41.7015, lng: -71.155 },
  { slug: "hartford", name: "Archdiocese of Hartford", city: "Hartford, CT", country: "US", group: "us-1", lat: 41.7658, lng: -72.6734 },
  { slug: "manchester", name: "Diocese of Manchester", city: "Manchester, NH", country: "US", group: "us-1", lat: 42.9956, lng: -71.4548 },
  { slug: "norwich", name: "Diocese of Norwich", city: "Norwich, CT", country: "US", group: "us-1", lat: 41.5243, lng: -72.0759 },
  { slug: "portland-me", name: "Diocese of Portland", city: "Portland, ME", country: "US", group: "us-1", lat: 43.6591, lng: -70.2568 },
  { slug: "providence", name: "Diocese of Providence", city: "Providence, RI", country: "US", group: "us-1", lat: 41.824, lng: -71.4128 },
  { slug: "springfield-ma", name: "Diocese of Springfield in Massachusetts", city: "Springfield, MA", country: "US", group: "us-1", lat: 42.1015, lng: -72.5898 },
  { slug: "worcester", name: "Diocese of Worcester", city: "Worcester, MA", country: "US", group: "us-1", lat: 42.2626, lng: -71.8023 },

  // ── Region II: New York ─────────────────────────────────────────────────
  { slug: "albany", name: "Diocese of Albany", city: "Albany, NY", country: "US", group: "us-2", lat: 42.6526, lng: -73.7562 },
  { slug: "brooklyn", name: "Diocese of Brooklyn", city: "Brooklyn, NY", country: "US", group: "us-2", lat: 40.6782, lng: -73.9442 },
  { slug: "buffalo", name: "Diocese of Buffalo", city: "Buffalo, NY", country: "US", group: "us-2", lat: 42.8864, lng: -78.8784 },
  { slug: "new-york", name: "Archdiocese of New York", city: "New York, NY", country: "US", group: "us-2", lat: 40.7128, lng: -74.006 },
  { slug: "ogdensburg", name: "Diocese of Ogdensburg", city: "Ogdensburg, NY", country: "US", group: "us-2", lat: 44.6942, lng: -75.4863 },
  { slug: "rochester", name: "Diocese of Rochester", city: "Rochester, NY", country: "US", group: "us-2", lat: 43.1566, lng: -77.6088 },
  { slug: "rockville-centre", name: "Diocese of Rockville Centre", city: "Rockville Centre, NY", country: "US", group: "us-2", lat: 40.6587, lng: -73.6412 },
  { slug: "syracuse", name: "Diocese of Syracuse", city: "Syracuse, NY", country: "US", group: "us-2", lat: 43.0481, lng: -76.1474 },

  // ── Region III: New Jersey & Pennsylvania ───────────────────────────────
  { slug: "allentown", name: "Diocese of Allentown", city: "Allentown, PA", country: "US", group: "us-3", lat: 40.6084, lng: -75.4902 },
  { slug: "altoona-johnstown", name: "Diocese of Altoona-Johnstown", city: "Altoona, PA", country: "US", group: "us-3", lat: 40.5187, lng: -78.3947 },
  { slug: "camden", name: "Diocese of Camden", city: "Camden, NJ", country: "US", group: "us-3", lat: 39.9259, lng: -75.1196 },
  { slug: "erie", name: "Diocese of Erie", city: "Erie, PA", country: "US", group: "us-3", lat: 42.1292, lng: -80.0851 },
  { slug: "greensburg", name: "Diocese of Greensburg", city: "Greensburg, PA", country: "US", group: "us-3", lat: 40.3015, lng: -79.5389 },
  { slug: "harrisburg", name: "Diocese of Harrisburg", city: "Harrisburg, PA", country: "US", group: "us-3", lat: 40.2732, lng: -76.8867 },
  { slug: "metuchen", name: "Diocese of Metuchen", city: "Metuchen, NJ", country: "US", group: "us-3", lat: 40.5407, lng: -74.3632 },
  { slug: "newark", name: "Archdiocese of Newark", city: "Newark, NJ", country: "US", group: "us-3", lat: 40.7357, lng: -74.1724 },
  { slug: "paterson", name: "Diocese of Paterson", city: "Paterson, NJ", country: "US", group: "us-3", lat: 40.9168, lng: -74.1718 },
  { slug: "philadelphia", name: "Archdiocese of Philadelphia", city: "Philadelphia, PA", country: "US", group: "us-3", lat: 39.9526, lng: -75.1652 },
  { slug: "pittsburgh", name: "Diocese of Pittsburgh", city: "Pittsburgh, PA", country: "US", group: "us-3", lat: 40.4406, lng: -79.9959 },
  { slug: "scranton", name: "Diocese of Scranton", city: "Scranton, PA", country: "US", group: "us-3", lat: 41.409, lng: -75.6624 },
  { slug: "trenton", name: "Diocese of Trenton", city: "Trenton, NJ", country: "US", group: "us-3", lat: 40.2206, lng: -74.7597 },

  // ── Region IV: Mid-Atlantic ─────────────────────────────────────────────
  { slug: "arlington", name: "Diocese of Arlington", city: "Arlington, VA", country: "US", group: "us-4", lat: 38.8816, lng: -77.091 },
  { slug: "baltimore", name: "Archdiocese of Baltimore", city: "Baltimore, MD", country: "US", group: "us-4", lat: 39.2904, lng: -76.6122 },
  { slug: "richmond", name: "Diocese of Richmond", city: "Richmond, VA", country: "US", group: "us-4", lat: 37.5407, lng: -77.436 },
  { slug: "saint-thomas-vi", name: "Diocese of Saint Thomas in the U.S. Virgin Islands", city: "Saint Thomas, VI", country: "US", group: "us-4", lat: 18.3419, lng: -64.9307 },
  { slug: "military-services-usa", name: "Archdiocese for the Military Services, USA", city: "Washington, DC", country: "US", group: "us-4", lat: 38.9072, lng: -77.0369, national: true },
  { slug: "washington", name: "Archdiocese of Washington", city: "Washington, DC", country: "US", group: "us-4", lat: 38.9072, lng: -77.0369 },
  { slug: "wheeling-charleston", name: "Diocese of Wheeling-Charleston", city: "Wheeling, WV", country: "US", group: "us-4", lat: 40.064, lng: -80.7209 },
  { slug: "wilmington", name: "Diocese of Wilmington", city: "Wilmington, DE", country: "US", group: "us-4", lat: 39.7391, lng: -75.5398 },

  // ── Region V: South Central ─────────────────────────────────────────────
  { slug: "alexandria-la", name: "Diocese of Alexandria", city: "Alexandria, LA", country: "US", group: "us-5", lat: 31.3113, lng: -92.4451 },
  { slug: "baton-rouge", name: "Diocese of Baton Rouge", city: "Baton Rouge, LA", country: "US", group: "us-5", lat: 30.4515, lng: -91.1871 },
  { slug: "biloxi", name: "Diocese of Biloxi", city: "Biloxi, MS", country: "US", group: "us-5", lat: 30.396, lng: -88.8853 },
  { slug: "birmingham", name: "Diocese of Birmingham", city: "Birmingham, AL", country: "US", group: "us-5", lat: 33.5186, lng: -86.8104 },
  { slug: "covington", name: "Diocese of Covington", city: "Covington, KY", country: "US", group: "us-5", lat: 39.0837, lng: -84.5086 },
  { slug: "houma-thibodaux", name: "Diocese of Houma-Thibodaux", city: "Houma, LA", country: "US", group: "us-5", lat: 29.5958, lng: -90.7195 },
  { slug: "jackson", name: "Diocese of Jackson", city: "Jackson, MS", country: "US", group: "us-5", lat: 32.2988, lng: -90.1848 },
  { slug: "knoxville", name: "Diocese of Knoxville", city: "Knoxville, TN", country: "US", group: "us-5", lat: 35.9606, lng: -83.9207 },
  { slug: "lafayette-la", name: "Diocese of Lafayette in Louisiana", city: "Lafayette, LA", country: "US", group: "us-5", lat: 30.2241, lng: -92.0198 },
  { slug: "lake-charles", name: "Diocese of Lake Charles", city: "Lake Charles, LA", country: "US", group: "us-5", lat: 30.2266, lng: -93.2174 },
  { slug: "lexington", name: "Diocese of Lexington", city: "Lexington, KY", country: "US", group: "us-5", lat: 38.0406, lng: -84.5037 },
  { slug: "louisville", name: "Archdiocese of Louisville", city: "Louisville, KY", country: "US", group: "us-5", lat: 38.2527, lng: -85.7585 },
  { slug: "memphis", name: "Diocese of Memphis", city: "Memphis, TN", country: "US", group: "us-5", lat: 35.1495, lng: -90.049 },
  { slug: "mobile", name: "Archdiocese of Mobile", city: "Mobile, AL", country: "US", group: "us-5", lat: 30.6954, lng: -88.0399 },
  { slug: "nashville", name: "Diocese of Nashville", city: "Nashville, TN", country: "US", group: "us-5", lat: 36.1627, lng: -86.7816 },
  { slug: "new-orleans", name: "Archdiocese of New Orleans", city: "New Orleans, LA", country: "US", group: "us-5", lat: 29.9511, lng: -90.0715 },
  { slug: "owensboro", name: "Diocese of Owensboro", city: "Owensboro, KY", country: "US", group: "us-5", lat: 37.7742, lng: -87.1133 },
  { slug: "shreveport", name: "Diocese of Shreveport", city: "Shreveport, LA", country: "US", group: "us-5", lat: 32.5252, lng: -93.7502 },

  // ── Region VI: Ohio & Michigan ──────────────────────────────────────────
  { slug: "cincinnati", name: "Archdiocese of Cincinnati", city: "Cincinnati, OH", country: "US", group: "us-6", lat: 39.1031, lng: -84.512 },
  { slug: "cleveland", name: "Diocese of Cleveland", city: "Cleveland, OH", country: "US", group: "us-6", lat: 41.4993, lng: -81.6944 },
  { slug: "columbus", name: "Diocese of Columbus", city: "Columbus, OH", country: "US", group: "us-6", lat: 39.9612, lng: -82.9988 },
  { slug: "detroit", name: "Archdiocese of Detroit", city: "Detroit, MI", country: "US", group: "us-6", lat: 42.3314, lng: -83.0458 },
  { slug: "gaylord", name: "Diocese of Gaylord", city: "Gaylord, MI", country: "US", group: "us-6", lat: 45.0275, lng: -84.6748 },
  { slug: "grand-rapids", name: "Diocese of Grand Rapids", city: "Grand Rapids, MI", country: "US", group: "us-6", lat: 42.9634, lng: -85.6681 },
  { slug: "kalamazoo", name: "Diocese of Kalamazoo", city: "Kalamazoo, MI", country: "US", group: "us-6", lat: 42.2917, lng: -85.5872 },
  { slug: "lansing", name: "Diocese of Lansing", city: "Lansing, MI", country: "US", group: "us-6", lat: 42.7325, lng: -84.5555 },
  { slug: "marquette", name: "Diocese of Marquette", city: "Marquette, MI", country: "US", group: "us-6", lat: 46.5436, lng: -87.3954 },
  { slug: "saginaw", name: "Diocese of Saginaw", city: "Saginaw, MI", country: "US", group: "us-6", lat: 43.4195, lng: -83.9508 },
  { slug: "steubenville", name: "Diocese of Steubenville", city: "Steubenville, OH", country: "US", group: "us-6", lat: 40.3698, lng: -80.6339 },
  { slug: "toledo", name: "Diocese of Toledo", city: "Toledo, OH", country: "US", group: "us-6", lat: 41.6528, lng: -83.5379 },
  { slug: "youngstown", name: "Diocese of Youngstown", city: "Youngstown, OH", country: "US", group: "us-6", lat: 41.0998, lng: -80.6495 },

  // ── Region VII: Illinois, Indiana & Wisconsin ───────────────────────────
  { slug: "belleville", name: "Diocese of Belleville", city: "Belleville, IL", country: "US", group: "us-7", lat: 38.52, lng: -89.984 },
  { slug: "chicago", name: "Archdiocese of Chicago", city: "Chicago, IL", country: "US", group: "us-7", lat: 41.8781, lng: -87.6298 },
  { slug: "evansville", name: "Diocese of Evansville", city: "Evansville, IN", country: "US", group: "us-7", lat: 37.9716, lng: -87.5711 },
  { slug: "fort-wayne-south-bend", name: "Diocese of Fort Wayne-South Bend", city: "Fort Wayne, IN", country: "US", group: "us-7", lat: 41.0793, lng: -85.1394 },
  { slug: "gary", name: "Diocese of Gary", city: "Gary, IN", country: "US", group: "us-7", lat: 41.5934, lng: -87.3464 },
  { slug: "green-bay", name: "Diocese of Green Bay", city: "Green Bay, WI", country: "US", group: "us-7", lat: 44.5133, lng: -88.0133 },
  { slug: "indianapolis", name: "Archdiocese of Indianapolis", city: "Indianapolis, IN", country: "US", group: "us-7", lat: 39.7684, lng: -86.1581 },
  { slug: "joliet", name: "Diocese of Joliet", city: "Joliet, IL", country: "US", group: "us-7", lat: 41.525, lng: -88.0817 },
  { slug: "la-crosse", name: "Diocese of La Crosse", city: "La Crosse, WI", country: "US", group: "us-7", lat: 43.8014, lng: -91.2396 },
  { slug: "lafayette-in", name: "Diocese of Lafayette in Indiana", city: "Lafayette, IN", country: "US", group: "us-7", lat: 40.4167, lng: -86.8753 },
  { slug: "madison", name: "Diocese of Madison", city: "Madison, WI", country: "US", group: "us-7", lat: 43.0731, lng: -89.4012 },
  { slug: "milwaukee", name: "Archdiocese of Milwaukee", city: "Milwaukee, WI", country: "US", group: "us-7", lat: 43.0389, lng: -87.9065 },
  { slug: "peoria", name: "Diocese of Peoria", city: "Peoria, IL", country: "US", group: "us-7", lat: 40.6936, lng: -89.589 },
  { slug: "rockford", name: "Diocese of Rockford", city: "Rockford, IL", country: "US", group: "us-7", lat: 42.2711, lng: -89.0937 },
  { slug: "springfield-il", name: "Diocese of Springfield in Illinois", city: "Springfield, IL", country: "US", group: "us-7", lat: 39.7817, lng: -89.6501 },
  { slug: "superior", name: "Diocese of Superior", city: "Superior, WI", country: "US", group: "us-7", lat: 46.7208, lng: -92.1041 },

  // ── Region VIII: Minnesota & Dakotas ────────────────────────────────────
  { slug: "bismarck", name: "Diocese of Bismarck", city: "Bismarck, ND", country: "US", group: "us-8", lat: 46.8083, lng: -100.7837 },
  { slug: "crookston", name: "Diocese of Crookston", city: "Crookston, MN", country: "US", group: "us-8", lat: 47.7745, lng: -96.6081 },
  { slug: "duluth", name: "Diocese of Duluth", city: "Duluth, MN", country: "US", group: "us-8", lat: 46.7867, lng: -92.1005 },
  { slug: "fargo", name: "Diocese of Fargo", city: "Fargo, ND", country: "US", group: "us-8", lat: 46.8772, lng: -96.7898 },
  { slug: "new-ulm", name: "Diocese of New Ulm", city: "New Ulm, MN", country: "US", group: "us-8", lat: 44.3125, lng: -94.4605 },
  { slug: "rapid-city", name: "Diocese of Rapid City", city: "Rapid City, SD", country: "US", group: "us-8", lat: 44.0805, lng: -103.231 },
  { slug: "saint-cloud", name: "Diocese of Saint Cloud", city: "St. Cloud, MN", country: "US", group: "us-8", lat: 45.5579, lng: -94.1632 },
  { slug: "saint-paul-minneapolis", name: "Archdiocese of Saint Paul and Minneapolis", city: "Saint Paul, MN", country: "US", group: "us-8", lat: 44.9537, lng: -93.09 },
  { slug: "sioux-falls", name: "Diocese of Sioux Falls", city: "Sioux Falls, SD", country: "US", group: "us-8", lat: 43.5446, lng: -96.7311 },
  { slug: "winona-rochester", name: "Diocese of Winona-Rochester", city: "Winona, MN", country: "US", group: "us-8", lat: 44.05, lng: -91.6393 },

  // ── Region IX: Iowa, Kansas, Missouri & Nebraska ────────────────────────
  { slug: "davenport", name: "Diocese of Davenport", city: "Davenport, IA", country: "US", group: "us-9", lat: 41.5236, lng: -90.5776 },
  { slug: "des-moines", name: "Diocese of Des Moines", city: "Des Moines, IA", country: "US", group: "us-9", lat: 41.5868, lng: -93.625 },
  { slug: "dodge-city", name: "Diocese of Dodge City", city: "Dodge City, KS", country: "US", group: "us-9", lat: 37.7528, lng: -100.0171 },
  { slug: "dubuque", name: "Archdiocese of Dubuque", city: "Dubuque, IA", country: "US", group: "us-9", lat: 42.5006, lng: -90.6646 },
  { slug: "grand-island", name: "Diocese of Grand Island", city: "Grand Island, NE", country: "US", group: "us-9", lat: 40.9264, lng: -98.342 },
  { slug: "jefferson-city", name: "Diocese of Jefferson City", city: "Jefferson City, MO", country: "US", group: "us-9", lat: 38.5767, lng: -92.1735 },
  { slug: "kansas-city-ks", name: "Archdiocese of Kansas City in Kansas", city: "Kansas City, KS", country: "US", group: "us-9", lat: 39.1155, lng: -94.6268 },
  { slug: "kansas-city-saint-joseph", name: "Diocese of Kansas City–Saint Joseph", city: "Kansas City, MO", country: "US", group: "us-9", lat: 39.0997, lng: -94.5786 },
  { slug: "lincoln", name: "Diocese of Lincoln", city: "Lincoln, NE", country: "US", group: "us-9", lat: 40.8136, lng: -96.7026 },
  { slug: "omaha", name: "Archdiocese of Omaha", city: "Omaha, NE", country: "US", group: "us-9", lat: 41.2565, lng: -95.9345 },
  { slug: "saint-louis", name: "Archdiocese of Saint Louis", city: "St. Louis, MO", country: "US", group: "us-9", lat: 38.627, lng: -90.1994 },
  { slug: "salina", name: "Diocese of Salina", city: "Salina, KS", country: "US", group: "us-9", lat: 38.8403, lng: -97.6114 },
  { slug: "sioux-city", name: "Diocese of Sioux City", city: "Sioux City, IA", country: "US", group: "us-9", lat: 42.4999, lng: -96.4003 },
  { slug: "springfield-cape-girardeau", name: "Diocese of Springfield–Cape Girardeau", city: "Springfield, MO", country: "US", group: "us-9", lat: 37.2089, lng: -93.2923 },
  { slug: "wichita", name: "Diocese of Wichita", city: "Wichita, KS", country: "US", group: "us-9", lat: 37.6872, lng: -97.3301 },

  // ── Region X: Arkansas, Oklahoma & Texas ────────────────────────────────
  { slug: "amarillo", name: "Diocese of Amarillo", city: "Amarillo, TX", country: "US", group: "us-10", lat: 35.222, lng: -101.8313 },
  { slug: "austin", name: "Diocese of Austin", city: "Austin, TX", country: "US", group: "us-10", lat: 30.2672, lng: -97.7431 },
  { slug: "beaumont", name: "Diocese of Beaumont", city: "Beaumont, TX", country: "US", group: "us-10", lat: 30.0802, lng: -94.1266 },
  { slug: "brownsville", name: "Diocese of Brownsville", city: "Brownsville, TX", country: "US", group: "us-10", lat: 25.9017, lng: -97.4975 },
  { slug: "corpus-christi", name: "Diocese of Corpus Christi", city: "Corpus Christi, TX", country: "US", group: "us-10", lat: 27.8006, lng: -97.3964 },
  { slug: "dallas", name: "Diocese of Dallas", city: "Dallas, TX", country: "US", group: "us-10", lat: 32.7767, lng: -96.797 },
  { slug: "el-paso", name: "Diocese of El Paso", city: "El Paso, TX", country: "US", group: "us-10", lat: 31.7619, lng: -106.485 },
  { slug: "fort-worth", name: "Diocese of Fort Worth", city: "Fort Worth, TX", country: "US", group: "us-10", lat: 32.7555, lng: -97.3308 },
  { slug: "galveston-houston", name: "Archdiocese of Galveston-Houston", city: "Houston, TX", country: "US", group: "us-10", lat: 29.7604, lng: -95.3698 },
  { slug: "laredo", name: "Diocese of Laredo", city: "Laredo, TX", country: "US", group: "us-10", lat: 27.5306, lng: -99.4803 },
  { slug: "little-rock", name: "Diocese of Little Rock", city: "Little Rock, AR", country: "US", group: "us-10", lat: 34.7465, lng: -92.2896 },
  { slug: "lubbock", name: "Diocese of Lubbock", city: "Lubbock, TX", country: "US", group: "us-10", lat: 33.5779, lng: -101.8552 },
  { slug: "oklahoma-city", name: "Archdiocese of Oklahoma City", city: "Oklahoma City, OK", country: "US", group: "us-10", lat: 35.4676, lng: -97.5164 },
  { slug: "san-angelo", name: "Diocese of San Angelo", city: "San Angelo, TX", country: "US", group: "us-10", lat: 31.4638, lng: -100.437 },
  { slug: "san-antonio", name: "Archdiocese of San Antonio", city: "San Antonio, TX", country: "US", group: "us-10", lat: 29.4241, lng: -98.4936 },
  { slug: "tulsa", name: "Diocese of Tulsa", city: "Tulsa, OK", country: "US", group: "us-10", lat: 36.154, lng: -95.9928 },
  { slug: "tyler", name: "Diocese of Tyler", city: "Tyler, TX", country: "US", group: "us-10", lat: 32.3513, lng: -95.3011 },
  { slug: "victoria-tx", name: "Diocese of Victoria in Texas", city: "Victoria, TX", country: "US", group: "us-10", lat: 28.8053, lng: -97.0036 },
  { slug: "ordinariate-chair-of-saint-peter", name: "Personal Ordinariate of the Chair of Saint Peter", city: "Houston, TX", country: "US", group: "us-10", lat: 29.7604, lng: -95.3698, national: true },

  // ── Region XI: California & Hawaii ──────────────────────────────────────
  { slug: "fresno", name: "Diocese of Fresno", city: "Fresno, CA", country: "US", group: "us-11", lat: 36.7378, lng: -119.7871 },
  { slug: "honolulu", name: "Diocese of Honolulu", city: "Honolulu, HI", country: "US", group: "us-11", lat: 21.3069, lng: -157.8583 },
  { slug: "los-angeles", name: "Archdiocese of Los Angeles", city: "Los Angeles, CA", country: "US", group: "us-11", lat: 34.0522, lng: -118.2437 },
  { slug: "monterey", name: "Diocese of Monterey", city: "Monterey, CA", country: "US", group: "us-11", lat: 36.6002, lng: -121.8947 },
  { slug: "oakland", name: "Diocese of Oakland", city: "Oakland, CA", country: "US", group: "us-11", lat: 37.8044, lng: -122.2712 },
  { slug: "orange", name: "Diocese of Orange", city: "Orange, CA", country: "US", group: "us-11", lat: 33.7879, lng: -117.8531 },
  { slug: "sacramento", name: "Diocese of Sacramento", city: "Sacramento, CA", country: "US", group: "us-11", lat: 38.5816, lng: -121.4944 },
  { slug: "san-bernardino", name: "Diocese of San Bernardino", city: "San Bernardino, CA", country: "US", group: "us-11", lat: 34.1083, lng: -117.2898 },
  { slug: "san-diego", name: "Diocese of San Diego", city: "San Diego, CA", country: "US", group: "us-11", lat: 32.7157, lng: -117.1611 },
  { slug: "san-francisco", name: "Archdiocese of San Francisco", city: "San Francisco, CA", country: "US", group: "us-11", lat: 37.7749, lng: -122.4194 },
  { slug: "san-jose", name: "Diocese of San Jose", city: "San Jose, CA", country: "US", group: "us-11", lat: 37.3382, lng: -121.8863 },
  { slug: "santa-rosa", name: "Diocese of Santa Rosa", city: "Santa Rosa, CA", country: "US", group: "us-11", lat: 38.4404, lng: -122.7141 },
  { slug: "stockton", name: "Diocese of Stockton", city: "Stockton, CA", country: "US", group: "us-11", lat: 37.9577, lng: -121.2908 },

  // ── Region XII: Alaska, Idaho, Montana, Oregon & Washington ─────────────
  { slug: "anchorage-juneau", name: "Archdiocese of Anchorage-Juneau", city: "Anchorage, AK", country: "US", group: "us-12", lat: 61.2181, lng: -149.9003 },
  { slug: "baker", name: "Diocese of Baker", city: "Baker City, OR", country: "US", group: "us-12", lat: 44.7749, lng: -117.8344 },
  { slug: "boise", name: "Diocese of Boise", city: "Boise, ID", country: "US", group: "us-12", lat: 43.615, lng: -116.2023 },
  { slug: "fairbanks", name: "Diocese of Fairbanks", city: "Fairbanks, AK", country: "US", group: "us-12", lat: 64.8378, lng: -147.7164 },
  { slug: "great-falls-billings", name: "Diocese of Great Falls-Billings", city: "Great Falls, MT", country: "US", group: "us-12", lat: 47.5053, lng: -111.3008 },
  { slug: "helena", name: "Diocese of Helena", city: "Helena, MT", country: "US", group: "us-12", lat: 46.5891, lng: -112.0391 },
  { slug: "portland-or", name: "Archdiocese of Portland in Oregon", city: "Portland, OR", country: "US", group: "us-12", lat: 45.5152, lng: -122.6784 },
  { slug: "seattle", name: "Archdiocese of Seattle", city: "Seattle, WA", country: "US", group: "us-12", lat: 47.6062, lng: -122.3321 },
  { slug: "spokane", name: "Diocese of Spokane", city: "Spokane, WA", country: "US", group: "us-12", lat: 47.6588, lng: -117.426 },
  { slug: "yakima", name: "Diocese of Yakima", city: "Yakima, WA", country: "US", group: "us-12", lat: 46.6021, lng: -120.5059 },

  // ── Region XIII: Mountain West ──────────────────────────────────────────
  { slug: "cheyenne", name: "Diocese of Cheyenne", city: "Cheyenne, WY", country: "US", group: "us-13", lat: 41.14, lng: -104.8202 },
  { slug: "colorado-springs", name: "Diocese of Colorado Springs", city: "Colorado Springs, CO", country: "US", group: "us-13", lat: 38.8339, lng: -104.8214 },
  { slug: "denver", name: "Archdiocese of Denver", city: "Denver, CO", country: "US", group: "us-13", lat: 39.7392, lng: -104.9903 },
  { slug: "gallup", name: "Diocese of Gallup", city: "Gallup, NM", country: "US", group: "us-13", lat: 35.5281, lng: -108.7426 },
  { slug: "las-cruces", name: "Diocese of Las Cruces", city: "Las Cruces, NM", country: "US", group: "us-13", lat: 32.3199, lng: -106.7637 },
  { slug: "las-vegas", name: "Archdiocese of Las Vegas", city: "Las Vegas, NV", country: "US", group: "us-13", lat: 36.1699, lng: -115.1398 },
  { slug: "phoenix", name: "Diocese of Phoenix", city: "Phoenix, AZ", country: "US", group: "us-13", lat: 33.4484, lng: -112.074 },
  { slug: "pueblo", name: "Diocese of Pueblo", city: "Pueblo, CO", country: "US", group: "us-13", lat: 38.2544, lng: -104.6091 },
  { slug: "reno", name: "Diocese of Reno", city: "Reno, NV", country: "US", group: "us-13", lat: 39.5296, lng: -119.8138 },
  { slug: "salt-lake-city", name: "Diocese of Salt Lake City", city: "Salt Lake City, UT", country: "US", group: "us-13", lat: 40.7608, lng: -111.891 },
  { slug: "santa-fe", name: "Archdiocese of Santa Fe", city: "Santa Fe, NM", country: "US", group: "us-13", lat: 35.687, lng: -105.9378 },
  { slug: "tucson", name: "Diocese of Tucson", city: "Tucson, AZ", country: "US", group: "us-13", lat: 32.2226, lng: -110.9747 },

  // ── Region XIV: Florida, Georgia & the Carolinas ────────────────────────
  { slug: "atlanta", name: "Archdiocese of Atlanta", city: "Atlanta, GA", country: "US", group: "us-14", lat: 33.749, lng: -84.388 },
  { slug: "charleston", name: "Diocese of Charleston", city: "Charleston, SC", country: "US", group: "us-14", lat: 32.7765, lng: -79.9311 },
  { slug: "charlotte", name: "Diocese of Charlotte", city: "Charlotte, NC", country: "US", group: "us-14", lat: 35.2271, lng: -80.8431 },
  { slug: "miami", name: "Archdiocese of Miami", city: "Miami, FL", country: "US", group: "us-14", lat: 25.7617, lng: -80.1918 },
  { slug: "orlando", name: "Diocese of Orlando", city: "Orlando, FL", country: "US", group: "us-14", lat: 28.5383, lng: -81.3792 },
  { slug: "palm-beach", name: "Diocese of Palm Beach", city: "Palm Beach Gardens, FL", country: "US", group: "us-14", lat: 26.7056, lng: -80.0364 },
  { slug: "pensacola-tallahassee", name: "Diocese of Pensacola-Tallahassee", city: "Pensacola, FL", country: "US", group: "us-14", lat: 30.4213, lng: -87.2169 },
  { slug: "raleigh", name: "Diocese of Raleigh", city: "Raleigh, NC", country: "US", group: "us-14", lat: 35.7796, lng: -78.6382 },
  { slug: "saint-augustine", name: "Diocese of Saint Augustine", city: "St. Augustine, FL", country: "US", group: "us-14", lat: 29.9012, lng: -81.3124 },
  { slug: "saint-petersburg", name: "Diocese of Saint Petersburg", city: "St. Petersburg, FL", country: "US", group: "us-14", lat: 27.7676, lng: -82.6403 },
  { slug: "savannah", name: "Diocese of Savannah", city: "Savannah, GA", country: "US", group: "us-14", lat: 32.0809, lng: -81.0912 },
  { slug: "venice", name: "Diocese of Venice", city: "Venice, FL", country: "US", group: "us-14", lat: 27.0998, lng: -82.4543 },

  // ── United States — Eastern Catholic jurisdictions ──────────────────────
  { slug: "armenian-our-lady-of-nareg", name: "Armenian Catholic Eparchy of Our Lady of Nareg", city: "Glendale, CA", country: "US", group: "us-eastern", lat: 34.1425, lng: -118.2551, national: true },
  { slug: "byzantine-pittsburgh", name: "Byzantine Catholic Archeparchy of Pittsburgh", city: "Pittsburgh, PA", country: "US", group: "us-eastern", lat: 40.4406, lng: -79.9959, national: true },
  { slug: "byzantine-parma", name: "Byzantine Catholic Eparchy of Parma", city: "Parma, OH", country: "US", group: "us-eastern", lat: 41.4048, lng: -81.7229, national: true },
  { slug: "byzantine-passaic", name: "Byzantine Catholic Eparchy of Passaic", city: "Woodland Park, NJ", country: "US", group: "us-eastern", lat: 40.89, lng: -74.19, national: true },
  { slug: "byzantine-phoenix", name: "Byzantine Catholic Eparchy of Holy Protection of Mary of Phoenix", city: "Phoenix, AZ", country: "US", group: "us-eastern", lat: 33.4484, lng: -112.074, national: true },
  { slug: "chaldean-detroit", name: "Chaldean Catholic Eparchy of Saint Thomas the Apostle of Detroit", city: "Southfield, MI", country: "US", group: "us-eastern", lat: 42.4734, lng: -83.2219, national: true },
  { slug: "chaldean-san-diego", name: "Chaldean Catholic Eparchy of Saint Peter the Apostle of San Diego", city: "El Cajon, CA", country: "US", group: "us-eastern", lat: 32.7948, lng: -116.9625, national: true },
  { slug: "maronite-brooklyn", name: "Maronite Catholic Eparchy of Saint Maron of Brooklyn", city: "Brooklyn, NY", country: "US", group: "us-eastern", lat: 40.6782, lng: -73.9442, national: true },
  { slug: "maronite-los-angeles", name: "Maronite Catholic Eparchy of Our Lady of Lebanon of Los Angeles", city: "Los Angeles, CA", country: "US", group: "us-eastern", lat: 34.0522, lng: -118.2437, national: true },
  { slug: "melkite-newton", name: "Melkite Greek Catholic Eparchy of Newton", city: "Newton, MA", country: "US", group: "us-eastern", lat: 42.337, lng: -71.2092, national: true },
  { slug: "romanian-canton", name: "Romanian Catholic Eparchy of Saint George's in Canton", city: "Canton, OH", country: "US", group: "us-eastern", lat: 40.7989, lng: -81.3789, national: true },
  { slug: "syriac-newark", name: "Syriac Catholic Eparchy of Our Lady of Deliverance of Newark", city: "Bayonne, NJ", country: "US", group: "us-eastern", lat: 40.6687, lng: -74.1143, national: true },
  { slug: "syro-malabar-chicago", name: "Syro-Malabar Catholic Eparchy of Saint Thomas the Apostle of Chicago", city: "Chicago, IL", country: "US", group: "us-eastern", lat: 41.8781, lng: -87.6298, national: true },
  { slug: "syro-malankara-usa", name: "Syro-Malankara Catholic Eparchy in the USA", city: "Elmont, NY", country: "US", group: "us-eastern", lat: 40.7009, lng: -73.7029, national: true },
  { slug: "ukrainian-philadelphia", name: "Ukrainian Catholic Archeparchy of Philadelphia", city: "Philadelphia, PA", country: "US", group: "us-eastern", lat: 39.9526, lng: -75.1652, national: true },
  { slug: "ukrainian-parma", name: "Ukrainian Catholic Eparchy of Saint Josaphat in Parma", city: "Parma, OH", country: "US", group: "us-eastern", lat: 41.4048, lng: -81.7229, national: true },
  { slug: "ukrainian-chicago", name: "Ukrainian Catholic Eparchy of Saint Nicholas in Chicago", city: "Chicago, IL", country: "US", group: "us-eastern", lat: 41.8781, lng: -87.6298, national: true },
  { slug: "ukrainian-stamford", name: "Ukrainian Catholic Eparchy of Stamford", city: "Stamford, CT", country: "US", group: "us-eastern", lat: 41.0534, lng: -73.5387, national: true },
];

export const DEFAULT_DIOCESE_SLUG = "montreal";

export const DIOCESE_BY_SLUG: Record<string, Diocese> = Object.fromEntries(
  DIOCESES.map((d) => [d.slug, d]),
);

export function getDiocese(slug: string | null | undefined): Diocese {
  return (slug && DIOCESE_BY_SLUG[slug]) || DIOCESE_BY_SLUG[DEFAULT_DIOCESE_SLUG];
}

/** Short display label, e.g. "Montréal" or "Nashville". */
export function dioceseShortName(d: Diocese): string {
  return d.shortLabel ?? d.city.split(",")[0];
}

// ── Combined city views ───────────────────────────────────────────────────
// Some cities host several jurisdictions (Latin archdiocese + Maronite,
// Melkite, Ukrainian eparchies…). For each such city we expose a synthetic
// "all dioceses of <city>" entry whose slug is `all-<city-key>`; selecting it
// scopes the calendar, map, list, DMs and threads to every member diocese.

const citySlugKey = (city: string) =>
  city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const CITY_GROUP_PREFIX = "all-";

export const CITY_GROUPS: Diocese[] = (() => {
  const byCity = new Map<string, Diocese[]>();
  for (const d of DIOCESES) {
    const list = byCity.get(d.city) ?? [];
    list.push(d);
    byCity.set(d.city, list);
  }
  const out: Diocese[] = [];
  for (const [city, list] of byCity) {
    if (list.length < 2) continue;
    // Prefer a geographic (non-national) jurisdiction as the representative.
    const members = [...list].sort((a, b) => Number(!!a.national) - Number(!!b.national));
    const primary = members[0];
    const short = city.split(",")[0];
    out.push({
      slug: `${CITY_GROUP_PREFIX}${citySlugKey(city)}`,
      name: `All ${short} dioceses`,
      nameFr: `Tous les diocèses de ${short}`,
      shortLabel: `${short} — all`,
      city,
      country: primary.country,
      group: primary.group,
      lat: primary.lat,
      lng: primary.lng,
      members: members.map((m) => m.slug),
    });
  }
  return out.sort((a, b) => a.city.localeCompare(b.city));
})();

export const CITY_GROUP_BY_SLUG: Record<string, Diocese> = Object.fromEntries(
  CITY_GROUPS.map((g) => [g.slug, g]),
);

/** The combined city entry a real diocese belongs to, if any. */
export function cityGroupFor(d: Diocese): Diocese | null {
  return CITY_GROUPS.find((g) => g.members?.includes(d.slug)) ?? null;
}

/** Real diocese slugs a selection covers (itself, or all city members). */
export function scopeSlugsFor(d: Diocese): string[] {
  return d.members ?? [d.slug];
}

/** Two-letter province, territory, or state code from the diocese's see city. */
export function dioceseRegionCode(d: Diocese | null | undefined): string | null {
  if (!d) return null;
  return d.city.match(/,\s*([A-Z]{2})\s*$/)?.[1] ?? null;
}

/** Every real jurisdiction based in the same province, territory, or state. */
export function regionalDioceseSlugs(d: Diocese | null | undefined): string[] {
  const region = dioceseRegionCode(d);
  if (!d || !region) return [];
  return DIOCESES.filter(
    (candidate) => candidate.country === d.country && dioceseRegionCode(candidate) === region,
  ).map((candidate) => candidate.slug);
}

/** Real diocese slug to attribute new content to when a city view is active. */
export function primarySlugFor(d: Diocese): string {
  return d.members?.[0] ?? d.slug;
}

export function dioceseName(d: Diocese, lang: string): string {
  return lang?.startsWith("fr") && d.nameFr ? d.nameFr : d.name;
}

/** A short distinguishing label for a diocese (rite / city) used in compact chips. */
export function dioceseMiniName(d: Diocese, lang: string): string {
  const name = dioceseName(d, lang);
  const rite =
    /maronite/i.test(name) ? "Maronite" :
    /melkite/i.test(name) ? "Melkite" :
    /ukrainian/i.test(name) ? "Ukrainian" :
    /syro-malabar/i.test(name) ? "Syro-Malabar" :
    /armenian/i.test(name) ? "Armenian" :
    /chaldean/i.test(name) ? "Chaldean" :
    /syriac/i.test(name) ? "Syriac" :
    /ruthenian|byzantine/i.test(name) ? "Byzantine" :
    /personal ordinariate/i.test(name) ? "Ordinariate" :
    /military/i.test(name) ? "Military" :
    null;
  if (rite) return rite;
  const shortCity = d.city.split(",")[0];
  return lang?.startsWith("fr") ? shortCity : shortCity;
}

/** Order of the section headings in the picker. */
export const DIOCESE_GROUPS: string[] = [
  CA_ARCH,
  CA_DIO,
  CA_EAST,
  "us-1",
  "us-2",
  "us-3",
  "us-4",
  "us-5",
  "us-6",
  "us-7",
  "us-8",
  "us-9",
  "us-10",
  "us-11",
  "us-12",
  "us-13",
  "us-14",
  "us-eastern",
];

export const DIOCESE_GROUP_LABELS: Record<string, { en: string; fr: string }> = {
  [CA_ARCH]: { en: "Canada — Archdioceses", fr: "Canada — Archidiocèses" },
  [CA_DIO]: { en: "Canada — Dioceses", fr: "Canada — Diocèses" },
  [CA_EAST]: { en: "Canada — Eastern & special jurisdictions", fr: "Canada — Églises orientales et juridictions spéciales" },
  "us-1": { en: "United States — Region I: New England", fr: "États-Unis — Région I : Nouvelle-Angleterre" },
  "us-2": { en: "United States — Region II: New York", fr: "États-Unis — Région II : New York" },
  "us-3": { en: "United States — Region III: New Jersey & Pennsylvania", fr: "États-Unis — Région III : New Jersey et Pennsylvanie" },
  "us-4": { en: "United States — Region IV: Mid-Atlantic", fr: "États-Unis — Région IV : Atlantique central" },
  "us-5": { en: "United States — Region V: South Central", fr: "États-Unis — Région V : Centre-Sud" },
  "us-6": { en: "United States — Region VI: Ohio & Michigan", fr: "États-Unis — Région VI : Ohio et Michigan" },
  "us-7": { en: "United States — Region VII: Illinois, Indiana & Wisconsin", fr: "États-Unis — Région VII : Illinois, Indiana et Wisconsin" },
  "us-8": { en: "United States — Region VIII: Minnesota & Dakotas", fr: "États-Unis — Région VIII : Minnesota et Dakotas" },
  "us-9": { en: "United States — Region IX: Iowa, Kansas, Missouri & Nebraska", fr: "États-Unis — Région IX : Iowa, Kansas, Missouri et Nebraska" },
  "us-10": { en: "United States — Region X: Arkansas, Oklahoma & Texas", fr: "États-Unis — Région X : Arkansas, Oklahoma et Texas" },
  "us-11": { en: "United States — Region XI: California & Hawaii", fr: "États-Unis — Région XI : Californie et Hawaï" },
  "us-12": { en: "United States — Region XII: Alaska, Idaho, Montana, Oregon & Washington", fr: "États-Unis — Région XII : Alaska, Idaho, Montana, Oregon et Washington" },
  "us-13": { en: "United States — Region XIII: Mountain West", fr: "États-Unis — Région XIII : Montagnes de l'Ouest" },
  "us-14": { en: "United States — Region XIV: Florida, Georgia & the Carolinas", fr: "États-Unis — Région XIV : Floride, Géorgie et Carolines" },
  "us-eastern": { en: "United States — Eastern Catholic jurisdictions", fr: "États-Unis — Églises catholiques orientales" },
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest geographic (non-national) jurisdiction to a point. */
export function nearestDiocese(lat: number, lng: number): Diocese {
  let best = DIOCESE_BY_SLUG[DEFAULT_DIOCESE_SLUG];
  let bestKm = Infinity;
  for (const d of DIOCESES) {
    if (d.national) continue;
    const km = haversineKm(lat, lng, d.lat, d.lng);
    if (km < bestKm) {
      bestKm = km;
      best = d;
    }
  }
  return best;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function searchDioceses(query: string): Diocese[] {
  const q = normalize(query.trim());
  if (!q) return DIOCESES;
  return DIOCESES.filter((d) =>
    normalize(`${d.name} ${d.nameFr ?? ""} ${d.city} ${d.slug}`).includes(q),
  );
}

// ── Availability ──────────────────────────────────────────────────────────
// Every diocese and city view is open. Montréal, QC keeps a promotional note
// (verified status free for the first year); everywhere else pays right away.

export const UNLOCKED_CITY = "Montréal, QC";

/** Real diocese slugs currently open for use (all of them). */
export const UNLOCKED_DIOCESE_SLUGS: string[] = DIOCESES.map((d) => d.slug);

/** Unlocked slugs including every combined "all dioceses in this city" view. */
export const UNLOCKED_SLUGS: string[] = [
  ...UNLOCKED_DIOCESE_SLUGS,
  ...CITY_GROUPS.map((g) => g.slug),
];

/** True when the diocese (or city view) is currently usable — always true now. */
export function isDioceseUnlocked(_slug: string | null | undefined): boolean {
  return true;
}


/** The default landing view: all Montréal dioceses when the group exists. */
export const UNLOCKED_DEFAULT_SLUG: string =
  CITY_GROUPS.find((g) => g.city === UNLOCKED_CITY)?.slug ?? DEFAULT_DIOCESE_SLUG;
