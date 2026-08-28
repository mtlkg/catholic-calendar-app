-- Demo verified organizers + sample Montréal events for showcasing the calendar
DO $$
DECLARE
  u1 uuid := '11111111-1111-4111-8111-111111111111';
  u2 uuid := '22222222-2222-4222-8222-222222222222';
  u3 uuid := '33333333-3333-4333-8333-333333333333';
  d0 date := current_date;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.stjoseph@thecatholiccalendar.org', crypt('demo-only-'||u1::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.youngadults@thecatholiccalendar.org', crypt('demo-only-'||u2::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.oratory@thecatholiccalendar.org', crypt('demo-only-'||u3::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (u1,'organizer'),(u2,'organizer'),(u3,'organizer')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.organizer_profiles (user_id, org_name, parish, contact_email, status, diocese_slug, diocese_slugs, categories, representative_name)
  VALUES
    (u1,'[DEMO] St. Joseph Parish','St. Joseph Parish','demo.stjoseph@thecatholiccalendar.org','approved','montreal', ARRAY['montreal'], ARRAY['mass','adoration'], 'Demo Organizer'),
    (u2,'[DEMO] Montréal Young Adults','Notre-Dame','demo.youngadults@thecatholiccalendar.org','approved','montreal', ARRAY['montreal'], ARRAY['young_adults','social'], 'Demo Organizer'),
    (u3,'[DEMO] Oratory Ministries','Saint Joseph''s Oratory','demo.oratory@thecatholiccalendar.org','approved','montreal', ARRAY['montreal'], ARRAY['retreat','conference'], 'Demo Organizer')
  ON CONFLICT (user_id) DO UPDATE SET status='approved', org_name=EXCLUDED.org_name;

  INSERT INTO public.calendar_events
    (title, description, start_at, end_at, all_day, category, venue_name, address, latitude, longitude, parish, is_free, status, submitted_by_user_id, diocese_slug, is_featured, audience_scope, audience_diocese_slugs, audience_countries, event_language)
  VALUES
    ('[DEMO] Sunrise Mass','Daily Mass in the upper church.', (d0 + 1) + time '07:30', (d0 + 1) + time '08:15', false,'mass','St. Joseph Parish','1234 Rue Sainte-Catherine, Montréal, QC',45.5088,-73.5617,'St. Joseph Parish',true,'approved',u1,'montreal',false,'diocese', ARRAY[]::text[], ARRAY[]::text[],'en'),
    ('[DEMO] Holy Hour & Confessions','Adoration with confessions available.', (d0 + 1) + time '19:00', (d0 + 1) + time '20:30', false,'adoration','St. Joseph Parish','1234 Rue Sainte-Catherine, Montréal, QC',45.5088,-73.5617,'St. Joseph Parish',true,'approved',u1,'montreal',false,'diocese', ARRAY[]::text[], ARRAY[]::text[],'en'),
    ('[DEMO] Young Adults Pizza Night','Food, faith and friendship for 18–35.', (d0 + 1) + time '18:30', (d0 + 1) + time '21:00', false,'young_adults','Notre-Dame Hall','110 Rue Notre-Dame O, Montréal, QC',45.5045,-73.5563,'Notre-Dame',false,'approved',u2,'montreal',true,'diocese', ARRAY[]::text[], ARRAY[]::text[],'en'),
    ('[DEMO] Soupe populaire — bénévolat','Servons ensemble nos frères et sœurs.', (d0 + 3) + time '11:00', (d0 + 3) + time '14:00', false,'service','Centre communautaire','2050 Rue Saint-Denis, Montréal, QC',45.5175,-73.5673,'Notre-Dame',true,'approved',u2,'montreal',false,'diocese', ARRAY[]::text[], ARRAY[]::text[],'fr'),
    ('[DEMO] Bible Study: Gospel of John','Weekly small-group study.', (d0 + 3) + time '19:00', (d0 + 3) + time '20:30', false,'bible_study','Parish Library','1234 Rue Sainte-Catherine, Montréal, QC',45.5088,-73.5617,'St. Joseph Parish',true,'approved',u1,'montreal',false,'diocese', ARRAY[]::text[], ARRAY[]::text[],'en'),
    ('[DEMO] Oratory Candlelight Rosary','Rosary on the steps of the Oratory.', (d0 + 3) + time '20:00', (d0 + 3) + time '21:00', false,'other','Saint Joseph''s Oratory','3800 Chemin Queen Mary, Montréal, QC',45.4923,-73.6187,'Saint Joseph''s Oratory',true,'approved',u3,'montreal',false,'diocese', ARRAY[]::text[], ARRAY[]::text[],'en'),
    ('[DEMO] Provincial Youth Conference','A regional gathering for youth ministry leaders.', (d0 + 7) + time '09:00', (d0 + 7) + time '17:00', false,'conference','Palais des congrès','1001 Pl. Jean-Paul-Riopelle, Montréal, QC',45.5040,-73.5610,'Saint Joseph''s Oratory',false,'approved',u3,'montreal',true,'regional', ARRAY['montreal','saint-jean-longueuil']::text[], ARRAY[]::text[],'en'),
    ('[DEMO] Silent Weekend Retreat','Two days of silence, Mass and spiritual direction.', (d0 + 10) + time '09:00', (d0 + 12) + time '16:00', false,'retreat','Retreat House','2065 Rue Sherbrooke O, Montréal, QC',45.4950,-73.5830,'Saint Joseph''s Oratory',false,'approved',u3,'montreal',false,'diocese', ARRAY[]::text[], ARRAY[]::text[],'en'),
    ('[DEMO] Parish Fall Fundraiser','Dinner and silent auction for the parish roof.', (d0 + 10) + time '18:00', (d0 + 10) + time '22:00', false,'fundraiser','Parish Hall','1234 Rue Sainte-Catherine, Montréal, QC',45.5088,-73.5617,'St. Joseph Parish',false,'approved',u1,'montreal',false,'diocese', ARRAY[]::text[], ARRAY[]::text[],'en'),
    ('[DEMO] National Day of Prayer','Catholics across the country united in prayer.', (d0 + 14) + time '12:00', (d0 + 14) + time '13:00', false,'other','Saint Joseph''s Oratory','3800 Chemin Queen Mary, Montréal, QC',45.4923,-73.6187,'Saint Joseph''s Oratory',true,'approved',u3,'montreal',true,'national', ARRAY[]::text[], ARRAY['CA']::text[],'en');
END $$;