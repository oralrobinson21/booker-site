const DB_KEY = 'citytask_db_v1';

const enums = {
  businessStates: ['draft', 'created', 'onboarding', 'active', 'limited', 'suspended', 'archived'],
  checklistStatuses: ['incomplete', 'complete', 'blocked', 'optional', 'provider_gated'],
  providerStatuses: ['not_configured', 'configured', 'verified', 'degraded', 'failed', 'acknowledged', 'disabled'],
  roles: ['owner', 'admin', 'dispatcher', 'operations_manager', 'reviewer', 'finance', 'crew_lead', 'worker', 'read_only', 'platform_admin'],
  proReadiness: ['draft', 'profile_started', 'profile_complete', 'availability_missing', 'credential_pending', 'business_assignable', 'limited', 'suspended', 'archived'],
};

const checklistDefaults = [
  'profile_complete','service_area_configured','operating_hours_configured','service_catalog_configured','team_or_pro_configured','proof_policy_configured','storage_acknowledged','provider_gates_acknowledged'
];
const providerDefaults = ['supabase_storage','stripe_connect','stripe_billing','email','sms','telephony','iot','maps','monitoring'];

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function load() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return { users: [], businesses: [], memberships: [], checklists: [], providerGates: [], pros: [], customers: [], sites: [], serviceAreas: [], serviceCategories: [], serviceTypes: [], operatingHours: [], tasks: [], assignments: [], scheduleEntries: [], auditEvents: [] };
  return JSON.parse(raw);
}
function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function audit(db, evt) { db.auditEvents.unshift({ id: id(), created_at: now(), ...evt }); }

export function signup(email, password) {
  const db = load();
  if (db.users.some(u => u.email === email)) throw new Error('Account already exists for this email.');
  const user = { id: id(), email, passwordHash: btoa(password), created_at: now() };
  db.users.push(user);
  audit(db, { actor_user_id: user.id, actor_role: 'owner', event_type: 'user_created', object_type: 'user', object_id: user.id });
  save(db); localStorage.setItem('citytask_session', JSON.stringify({ userId: user.id, expiresAt: Date.now() + 1000*60*60*12 }));
  return user;
}
export function login(email, password) {
  const db = load();
  const u = db.users.find(x => x.email === email && x.passwordHash === btoa(password));
  if (!u) throw new Error('Invalid credentials');
  localStorage.setItem('citytask_session', JSON.stringify({ userId: u.id, expiresAt: Date.now() + 1000*60*60*12 }));
  audit(db, { actor_user_id: u.id, actor_role: 'owner', event_type: 'user_logged_in', object_type: 'session', object_id: u.id });
  save(db);
}
export function currentUser() {
  const s = JSON.parse(localStorage.getItem('citytask_session') || 'null'); if (!s || s.expiresAt < Date.now()) return null;
  const db = load(); return db.users.find(u => u.id === s.userId) || null;
}
export function logout() { localStorage.removeItem('citytask_session'); }

export function createBusiness(input) {
  const user = currentUser(); if (!user) throw new Error('401');
  const db = load();
  const business = { id: id(), lifecycle_state: 'onboarding', created_at: now(), updated_at: now(), ...input };
  db.businesses.push(business);
  db.memberships.push({ id: id(), business_id: business.id, user_id: user.id, role: 'owner', created_at: now() });
  checklistDefaults.forEach(key => db.checklists.push({ id: id(), business_id: business.id, key, label: key.replaceAll('_',' '), status: 'incomplete', required: true, completed_at: null, completed_by: null, blocker_reason: null, updated_at: now() }));
  providerDefaults.forEach(provider => db.providerGates.push({ id: id(), business_id: business.id, provider, status: 'not_configured', updated_at: now() }));
  audit(db, { actor_user_id: user.id, business_id: business.id, actor_role: 'owner', event_type: 'business_created', object_type: 'business', object_id: business.id, after_json: business });
  save(db);
  return business;
}

export function getBusinessContext() {
  const user = currentUser(); if (!user) throw new Error('401');
  const db = load();
  const membership = db.memberships.find(m => m.user_id === user.id);
  if (!membership) return { user, db, business: null, membership: null };
  const business = db.businesses.find(b => b.id === membership.business_id);
  return { user, db, business, membership };
}

export function upsertProProfile(data) {
  const { user, db, business, membership } = getBusinessContext(); if (!membership) throw new Error('403');
  let p = db.pros.find(x => x.user_id === user.id && x.business_id === business.id);
  if (!p) { p = { id: id(), user_id: user.id, business_id: business.id, readiness_state: 'draft', created_at: now() }; db.pros.push(p); }
  Object.assign(p, data, { updated_at: now() });
  p.readiness_state = p.display_name && p.service_tags?.length && p.availability ? 'business_assignable' : 'profile_started';
  audit(db, { actor_user_id: user.id, business_id: business.id, actor_role: membership.role, event_type: p.created_at===p.updated_at?'pro_profile_created':'pro_profile_updated', object_type: 'pro', object_id: p.id, after_json: p });
  save(db); return p;
}

export function createEntity(table, obj) {
  const { user, db, business, membership } = getBusinessContext(); if (!membership) throw new Error('403');
  if (table === 'tasks') {
    if (!obj.customer_id || !obj.site_id || !obj.service_type_id) throw new Error('task_missing_dependencies');
    const hasCustomer = db.customers.some(c => c.id === obj.customer_id && c.business_id === business.id);
    const hasSite = db.sites.some(s => s.id === obj.site_id && s.business_id === business.id);
    const service = db.serviceTypes.find(s => s.id === obj.service_type_id && s.business_id === business.id);
    if (!hasCustomer || !hasSite || !service) throw new Error('task_invalid_dependencies');
    if (service.active === false) throw new Error('service_inactive');
  }
  const row = { id: id(), business_id: business.id, created_at: now(), updated_at: now(), ...obj };
  db[table].push(row);
  audit(db, { actor_user_id: user.id, business_id: business.id, actor_role: membership.role, event_type: `${table.slice(0,-1)}_created`, object_type: table, object_id: row.id, after_json: row });
  save(db); return row;
}

export function listForBusiness(table) {
  const { business, membership, db } = getBusinessContext(); if (!membership) throw new Error('403');
  return db[table].filter(r => r.business_id === business.id);
}

export function dashboardData() {
  const ctx = getBusinessContext();
  const { db, business, membership, user } = ctx;
  if (!membership) return { user, needsBusiness: true, audits: db.auditEvents.slice(0, 10) };
  const bid = business.id;
  const by = (table) => db[table].filter(r => r.business_id === bid);
  return { user, business, membership, checklist: by('checklists'), providerGates: by('providerGates'), pros: by('pros'), customers: by('customers'), sites: by('sites'), tasks: by('tasks'), assignments: by('assignments'), scheduleEntries: by('scheduleEntries'), audits: db.auditEvents.filter(a => a.business_id===bid).slice(0,10) };
}
