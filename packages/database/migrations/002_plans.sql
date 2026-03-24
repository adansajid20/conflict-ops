CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly_cents INTEGER NOT NULL,
  max_missions INTEGER NOT NULL,
  max_members INTEGER NOT NULL,
  history_days INTEGER NOT NULL,
  api_access BOOLEAN DEFAULT false,
  webhooks BOOLEAN DEFAULT false,
  scenarios BOOLEAN DEFAULT false,
  ach_matrix BOOLEAN DEFAULT false,
  sat_suite BOOLEAN DEFAULT false,
  org_mode BOOLEAN DEFAULT false,
  audit_logs BOOLEAN DEFAULT false,
  sso_saml BOOLEAN DEFAULT false,
  custom_sources BOOLEAN DEFAULT false,
  white_label BOOLEAN DEFAULT false,
  scheduled_briefs BOOLEAN DEFAULT false,
  satellite_imagery BOOLEAN DEFAULT false,
  verification_queue BOOLEAN DEFAULT false,
  two_person_rule BOOLEAN DEFAULT false,
  domain_packs TEXT[] DEFAULT '{}',
  max_api_calls_per_day INTEGER DEFAULT 0,
  data_retention_days INTEGER DEFAULT 365,
  usage_based_billing BOOLEAN DEFAULT false
);

INSERT INTO plans VALUES
  ('individual','Individual',900,3,1,7,false,false,false,false,false,false,false,false,false,false,false,false,false,false,'{}',0,7,false),
  ('pro','Pro',2900,25,1,180,false,false,true,true,true,false,false,false,false,false,true,false,false,false,'{}',0,180,false),
  ('business','Business',29900,-1,50,365,true,true,true,true,true,true,true,false,false,false,true,true,true,true,ARRAY['maritime','aviation','chokepoint'],10000,365,true),
  ('enterprise','Enterprise',200000,-1,-1,-1,true,true,true,true,true,true,true,true,true,true,true,true,true,true,ARRAY['maritime','aviation','chokepoint','insurance','esgsec'],-1,-1,true);
