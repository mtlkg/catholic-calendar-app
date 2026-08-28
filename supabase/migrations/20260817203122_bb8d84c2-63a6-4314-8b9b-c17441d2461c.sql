CREATE TABLE IF NOT EXISTS public.dioceses (
  slug text PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  national boolean NOT NULL DEFAULT false
);

GRANT SELECT ON public.dioceses TO anon;
GRANT SELECT ON public.dioceses TO authenticated;
GRANT ALL ON public.dioceses TO service_role;

ALTER TABLE public.dioceses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dioceses are publicly readable" ON public.dioceses;
CREATE POLICY "Dioceses are publicly readable"
  ON public.dioceses FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.dioceses (slug, lat, lng) VALUES
('edmonton',53.5461,-113.4938),('gatineau',45.4765,-75.7013),('grouard-mclennan',55.7,-116.49),('halifax-yarmouth',44.6488,-63.5752),('keewatin-le-pas',53.825,-101.254),('kingston',44.2312,-76.486),('moncton',46.0878,-64.7782),('montreal',45.5019,-73.5674),('ottawa-cornwall',45.4215,-75.6972),('quebec',46.8139,-71.208),('regina',50.4452,-104.6189),('rimouski',48.4488,-68.5236),('saint-boniface',49.8844,-97.1189),('st-johns-nl',47.5615,-52.7126),('sherbrooke',45.4042,-71.8929),('toronto',43.6532,-79.3832),('vancouver',49.2827,-123.1207),('winnipeg',49.8951,-97.1384),('amos',48.5667,-78.1167),('antigonish',45.6167,-61.9986),('baie-comeau',49.2167,-68.15),('bathurst',47.6186,-65.6512),('calgary',51.0447,-114.0719),('charlottetown',46.2382,-63.1311),('chicoutimi',48.4283,-71.0687),('churchill-hudson-bay',58.7684,-94.165),('corner-brook-labrador',48.9509,-57.9522),('edmundston',47.3737,-68.325),('gaspe',48.8319,-64.4869),('grand-falls',48.9333,-55.6667),('hamilton',43.2557,-79.8711),('hearst-moosonee',49.6853,-83.6667),('joliette',46.0167,-73.4333),('kamloops',50.6745,-120.3273),('london',42.9849,-81.2453),('mackenzie-fort-smith',60.0044,-111.885),('nelson',49.4928,-117.2948),('nicolet',46.2236,-72.6167),('pembroke',45.8267,-77.1117),('peterborough',44.3091,-78.3197),('prince-albert',53.2033,-105.7531),('prince-george',53.9171,-122.7497),('rouyn-noranda',48.2359,-79.0232),('saint-catharines',43.1594,-79.2469),('saint-hyacinthe',45.6167,-72.95),('saint-jean-longueuil',45.5312,-73.5182),('saint-jerome-mont-laurier',45.78,-74.0033),('saint-john-nb',45.2733,-66.0633),('saint-paul-alberta',53.9928,-111.2972),('sainte-anne-de-la-pocatiere',47.3606,-70.0281),('saskatoon',52.1332,-106.67),('sault-sainte-marie',46.5136,-84.3358),('thunder-bay',48.3809,-89.2477),('timmins',48.4758,-81.3305),('trois-rivieres',46.3432,-72.5429),('valleyfield',45.2501,-74.1313),('victoria-bc',48.4284,-123.3656),('whitehorse',60.7212,-135.0568),('ukrainian-winnipeg',49.8951,-97.1384),('ukrainian-edmonton',53.5461,-113.4938),('ukrainian-new-westminster',49.2057,-122.911),('ukrainian-saskatoon',52.1332,-106.67),('ukrainian-toronto',43.6532,-79.3832),('chaldean-mar-addai-toronto',43.6532,-79.3832),('syro-malabar-mississauga',43.589,-79.6441),('maronite-montreal',45.5019,-73.5674),('melkite-montreal',45.5019,-73.5674),('ruthenian-toronto',43.6532,-79.3832),('syriac-canada',45.5019,-73.5674),('military-ordinariate-canada',45.4215,-75.6972),('boston',42.3601,-71.0589),('bridgeport',41.1865,-73.1952),('burlington',44.4759,-73.2121),('fall-river',41.7015,-71.155),('hartford',41.7658,-72.6734),('manchester',42.9956,-71.4548),('norwich',41.5243,-72.0759),('portland-me',43.6591,-70.2568),('providence',41.824,-71.4128),('springfield-ma',42.1015,-72.5898),('worcester',42.2626,-71.8023),('albany',42.6526,-73.7562),('brooklyn',40.6782,-73.9442),('buffalo',42.8864,-78.8784),('new-york',40.7128,-74.006),('ogdensburg',44.6942,-75.4863),('rochester',43.1566,-77.6088),('rockville-centre',40.6587,-73.6412),('syracuse',43.0481,-76.1474),('allentown',40.6084,-75.4902),('altoona-johnstown',40.5187,-78.3947),('camden',39.9259,-75.1196),('erie',42.1292,-80.0851),('greensburg',40.3015,-79.5389),('harrisburg',40.2732,-76.8867),('metuchen',40.5407,-74.3632),('newark',40.7357,-74.1724),('paterson',40.9168,-74.1718),('philadelphia',39.9526,-75.1652),('pittsburgh',40.4406,-79.9959),('scranton',41.409,-75.6624),('trenton',40.2206,-74.7597),('arlington',38.8816,-77.091),('baltimore',39.2904,-76.6122),('richmond',37.5407,-77.436),('saint-thomas-vi',18.3419,-64.9307),('military-services-usa',38.9072,-77.0369),('washington',38.9072,-77.0369),('wheeling-charleston',40.064,-80.7209),('wilmington',39.7391,-75.5398),('alexandria-la',31.3113,-92.4451),('baton-rouge',30.4515,-91.1871),('biloxi',30.396,-88.8853),('birmingham',33.5186,-86.8104),('covington',39.0837,-84.5086),('houma-thibodaux',29.5958,-90.7195),('jackson',32.2988,-90.1848),('knoxville',35.9606,-83.9207),('lafayette-la',30.2241,-92.0198),('lake-charles',30.2266,-93.2174),('lexington',38.0406,-84.5037),('louisville',38.2527,-85.7585),('memphis',35.1495,-90.049),('mobile',30.6954,-88.0399),('nashville',36.1627,-86.7816),('new-orleans',29.9511,-90.0715),('owensboro',37.7742,-87.1133),('shreveport',32.5252,-93.7502),('cincinnati',39.1031,-84.512),('cleveland',41.4993,-81.6944),('columbus',39.9612,-82.9988),('detroit',42.3314,-83.0458),('gaylord',45.0275,-84.6748),('grand-rapids',42.9634,-85.6681),('kalamazoo',42.2917,-85.5872),('lansing',42.7325,-84.5555),('marquette',46.5436,-87.3954),('saginaw',43.4195,-83.9508),('steubenville',40.3698,-80.6339),('toledo',41.6528,-83.5379),('youngstown',41.0998,-80.6495),('belleville',38.52,-89.984),('chicago',41.8781,-87.6298),('evansville',37.9716,-87.5711),('fort-wayne-south-bend',41.0793,-85.1394),('gary',41.5934,-87.3464),('green-bay',44.5133,-88.0133),('indianapolis',39.7684,-86.1581),('joliet',41.525,-88.0817),('la-crosse',43.8014,-91.2396),('lafayette-in',40.4167,-86.8753),('madison',43.0731,-89.4012),('milwaukee',43.0389,-87.9065),('peoria',40.6936,-89.589),('rockford',42.2711,-89.0937),('springfield-il',39.7817,-89.6501),('superior',46.7208,-92.1041),('bismarck',46.8083,-100.7837),('crookston',47.7745,-96.6081),('duluth',46.7867,-92.1005),('fargo',46.8772,-96.7898),('new-ulm',44.3125,-94.4605),('rapid-city',44.0805,-103.231),('saint-cloud',45.5579,-94.1632),('saint-paul-minneapolis',44.9537,-93.09),('sioux-falls',43.5446,-96.7311),('winona-rochester',44.05,-91.6393),('davenport',41.5236,-90.5776),('des-moines',41.5868,-93.625),('dodge-city',37.7528,-100.0171),('dubuque',42.5006,-90.6646),('grand-island',40.9264,-98.342),('jefferson-city',38.5767,-92.1735),('kansas-city-ks',39.1155,-94.6268),('kansas-city-saint-joseph',39.0997,-94.5786),('lincoln',40.8136,-96.7026),('omaha',41.2565,-95.9345),('saint-louis',38.627,-90.1994),('salina',38.8403,-97.6114),('sioux-city',42.4999,-96.4003),('springfield-cape-girardeau',37.2089,-93.2923),('wichita',37.6872,-97.3301),('amarillo',35.222,-101.8313),('austin',30.2672,-97.7431),('beaumont',30.0802,-94.1266),('brownsville',25.9017,-97.4975),('corpus-christi',27.8006,-97.3964),('dallas',32.7767,-96.797),('el-paso',31.7619,-106.485),('fort-worth',32.7555,-97.3308),('galveston-houston',29.7604,-95.3698),('laredo',27.5306,-99.4803),('little-rock',34.7465,-92.2896),('lubbock',33.5779,-101.8552),('oklahoma-city',35.4676,-97.5164),('san-angelo',31.4638,-100.437),('san-antonio',29.4241,-98.4936),('tulsa',36.154,-95.9928),('tyler',32.3513,-95.3011),('victoria-tx',28.8053,-97.0036),('ordinariate-chair-of-saint-peter',29.7604,-95.3698),('fresno',36.7378,-119.7871),('honolulu',21.3069,-157.8583),('los-angeles',34.0522,-118.2437),('monterey',36.6002,-121.8947),('oakland',37.8044,-122.2712),('orange',33.7879,-117.8531),('sacramento',38.5816,-121.4944),('san-bernardino',34.1083,-117.2898),('san-diego',32.7157,-117.1611),('san-francisco',37.7749,-122.4194),('san-jose',37.3382,-121.8863),('santa-rosa',38.4404,-122.7141),('stockton',37.9577,-121.2908),('anchorage-juneau',61.2181,-149.9003),('baker',44.7749,-117.8344),('boise',43.615,-116.2023),('fairbanks',64.8378,-147.7164),('great-falls-billings',47.5053,-111.3008),('helena',46.5891,-112.0391),('portland-or',45.5152,-122.6784),('seattle',47.6062,-122.3321),('spokane',47.6588,-117.426),('yakima',46.6021,-120.5059),('cheyenne',41.14,-104.8202),('colorado-springs',38.8339,-104.8214),('denver',39.7392,-104.9903),('gallup',35.5281,-108.7426),('las-cruces',32.3199,-106.7637),('las-vegas',36.1699,-115.1398),('phoenix',33.4484,-112.074),('pueblo',38.2544,-104.6091),('reno',39.5296,-119.8138),('salt-lake-city',40.7608,-111.891),('santa-fe',35.687,-105.9378),('tucson',32.2226,-110.9747),('atlanta',33.749,-84.388),('charleston',32.7765,-79.9311),('charlotte',35.2271,-80.8431),('miami',25.7617,-80.1918),('orlando',28.5383,-81.3792),('palm-beach',26.7056,-80.0364),('pensacola-tallahassee',30.4213,-87.2169),('raleigh',35.7796,-78.6382),('saint-augustine',29.9012,-81.3124),('saint-petersburg',27.7676,-82.6403),('savannah',32.0809,-81.0912),('venice',27.0998,-82.4543),('armenian-our-lady-of-nareg',34.1425,-118.2551),('byzantine-pittsburgh',40.4406,-79.9959),('byzantine-parma',41.4048,-81.7229),('byzantine-passaic',40.89,-74.19),('byzantine-phoenix',33.4484,-112.074),('chaldean-detroit',42.4734,-83.2219),('chaldean-san-diego',32.7948,-116.9625),('maronite-brooklyn',40.6782,-73.9442),('maronite-los-angeles',34.0522,-118.2437),('melkite-newton',42.337,-71.2092),('romanian-canton',40.7989,-81.3789),('syriac-newark',40.6687,-74.1143),('syro-malabar-chicago',41.8781,-87.6298),('syro-malankara-usa',40.7009,-73.7029),('ukrainian-philadelphia',39.9526,-75.1652),('ukrainian-parma',41.4048,-81.7229),('ukrainian-chicago',41.8781,-87.6298),('ukrainian-stamford',41.0534,-73.5387)
ON CONFLICT (slug) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng;

UPDATE public.dioceses SET national = true WHERE slug IN (
'ukrainian-winnipeg','ukrainian-edmonton','ukrainian-new-westminster','ukrainian-saskatoon','ukrainian-toronto','chaldean-mar-addai-toronto','syro-malabar-mississauga','maronite-montreal','melkite-montreal','ruthenian-toronto','syriac-canada','military-ordinariate-canada','military-services-usa','ordinariate-chair-of-saint-peter','armenian-our-lady-of-nareg','byzantine-pittsburgh','byzantine-parma','byzantine-passaic','byzantine-phoenix','chaldean-detroit','chaldean-san-diego','maronite-brooklyn','maronite-los-angeles','melkite-newton','romanian-canton','syriac-newark','syro-malabar-chicago','syro-malankara-usa','ukrainian-philadelphia','ukrainian-parma','ukrainian-chicago','ukrainian-stamford');

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS diocese_slug text REFERENCES public.dioceses(slug);
ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS diocese_slug text REFERENCES public.dioceses(slug);

CREATE INDEX IF NOT EXISTS calendar_events_diocese_idx ON public.calendar_events(diocese_slug, start_at);
CREATE INDEX IF NOT EXISTS organizer_profiles_diocese_idx ON public.organizer_profiles(diocese_slug);

CREATE OR REPLACE FUNCTION public.nearest_diocese_slug(_lat double precision, _lng double precision)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT d.slug
  FROM public.dioceses d
  WHERE d.national = false AND _lat IS NOT NULL AND _lng IS NOT NULL
  ORDER BY (d.lat - _lat) * (d.lat - _lat)
         + ((d.lng - _lng) * cos(radians(_lat))) * ((d.lng - _lng) * cos(radians(_lat)))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.set_event_diocese()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.diocese_slug IS NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.diocese_slug := public.nearest_diocese_slug(NEW.latitude, NEW.longitude);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_events_set_diocese ON public.calendar_events;
CREATE TRIGGER calendar_events_set_diocese
  BEFORE INSERT OR UPDATE OF latitude, longitude, diocese_slug ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_event_diocese();

UPDATE public.calendar_events
SET diocese_slug = public.nearest_diocese_slug(latitude, longitude)
WHERE diocese_slug IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE OR REPLACE VIEW public.calendar_events_public AS
  SELECT id, title, description, category, category_other, start_at, end_at, all_day,
         venue_name, address, latitude, longitude, parish, is_free, price_note,
         registration_url, submitted_by_user_id, status, created_at, updated_at,
         is_featured, poster_url, diocese_slug
  FROM public.calendar_events
  WHERE status = 'approved'::event_status;

CREATE OR REPLACE VIEW public.organizer_profiles_public AS
  SELECT id, user_id, org_name, parish, description, categories, website_url,
         logo_url, status, created_at, updated_at, diocese_slug
  FROM public.organizer_profiles
  WHERE status = 'approved'::organizer_status;