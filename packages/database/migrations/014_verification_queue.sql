CREATE TABLE verification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id),
  status TEXT DEFAULT 'pending',
  first_reviewer_id UUID REFERENCES users(id),
  first_reviewed_at TIMESTAMPTZ,
  first_decision TEXT,
  second_reviewer_id UUID REFERENCES users(id),
  second_reviewed_at TIMESTAMPTZ,
  second_decision TEXT,
  final_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
