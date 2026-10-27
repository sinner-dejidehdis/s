// Accounts and cloud projects through Supabase (auth + one `projects` table
// protected by row-level security). Everything degrades to local-only when
// Supabase is not configured or its script did not load.
(function (root) {
  const S = root.Sigao = root.Sigao || {};
  const cfg = root.ARGUO_CONFIG || {};
  const lib = root.supabase;
  const client = cfg.supabaseUrl && cfg.supabaseAnonKey && lib ? lib.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  let user = null;
  const listeners = [];

  function fail(error) { if (error) throw new Error(error.message || 'Something went wrong.'); }

  async function init() {
    if (!client) return;
    const { data } = await client.auth.getSession();
    user = data.session ? data.session.user : null;
    client.auth.onAuthStateChange((event, session) => {
      user = session ? session.user : null;
      listeners.forEach((fn) => fn(event, user));
    });
  }

  const redirect = () => root.location.origin + root.location.pathname;

  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
    fail(error);
    return { needsConfirm: !data.session };
  }
  async function signIn(email, password) { fail((await client.auth.signInWithPassword({ email, password })).error); }
  async function signOut() { fail((await client.auth.signOut()).error); }
  async function sendReset(email) { fail((await client.auth.resetPasswordForEmail(email, { redirectTo: redirect() })).error); }
  async function setPassword(password) { fail((await client.auth.updateUser({ password })).error); }

  async function list() {
    const { data, error } = await client.from('projects').select('id, title, updated_at').order('updated_at', { ascending: false });
    fail(error);
    return data;
  }
  async function load(id) {
    const { data, error } = await client.from('projects').select('id, data').eq('id', id).single();
    fail(error);
    return Object.assign(data.data, { cloudId: data.id });
  }
  // Inserts when the project has no cloudId yet; returns the row id.
  async function save(project) {
    const data = Object.assign({}, project);
    delete data.cloudId;
    const row = { title: project.title || 'Untitled paper', data, updated_at: new Date().toISOString() };
    const q = project.cloudId
      ? client.from('projects').update(row).eq('id', project.cloudId).select('id').single()
      : client.from('projects').insert(row).select('id').single();
    const { data: saved, error } = await q;
    fail(error);
    return saved.id;
  }
  async function remove(id) { fail((await client.from('projects').delete().eq('id', id)).error); }

  S.cloud = {
    enabled: () => Boolean(client),
    user: () => user,
    onChange: (fn) => listeners.push(fn),
    init, signUp, signIn, signOut, sendReset, setPassword, list, load, save, remove,
  };
})(typeof window !== 'undefined' ? window : globalThis);
