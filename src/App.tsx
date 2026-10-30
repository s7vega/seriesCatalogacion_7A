import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Clapperboard,
  Film,
  LoaderCircle,
  MessageSquareText,
  Pencil,
  Plus,
  Star,
  Tv,
  X,
  Trash2,
  CircleAlert,
  Database,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Platform = {
  id: string;
  name: string;
  created_at: string;
};

type Series = {
  id: string;
  name: string;
  platform_id: string;
  created_at: string;
};

type Rating = {
  id: string;
  platform_id: string;
  series_id: string;
  score: number;
  observation: string;
  created_at: string;
};

type Tab = "series" | "platforms" | "ratings";
type Editor =
  | { kind: "platform"; record?: Platform }
  | { kind: "series"; record?: Series }
  | { kind: "rating"; record?: Rating };

const tabs: { id: Tab; label: string; icon: typeof Film }[] = [
  { id: "series", label: "Series", icon: Film },
  { id: "platforms", label: "Plataformas", icon: Tv },
  { id: "ratings", label: "Valoraciones", icon: Star },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes("foreign key")) {
    return "No se puede eliminar porque hay registros relacionados. Elimina primero sus valoraciones o series.";
  }
  if (error instanceof Error && error.message) {
    return `No se pudo completar la operación: ${error.message}`;
  }
  return "Ocurrió un error inesperado. Inténtalo nuevamente.";
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("series");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!supabase || !userEmail) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");
    try {
      const [platformResult, seriesResult, ratingResult] = await Promise.all([
        supabase.from("platforms").select("*").order("name"),
        supabase.from("series").select("*").order("name"),
        supabase.from("ratings").select("*").order("created_at", { ascending: false }),
      ]);

      if (platformResult.error) throw platformResult.error;
      if (seriesResult.error) throw seriesResult.error;
      if (ratingResult.error) throw ratingResult.error;

      setPlatforms(platformResult.data ?? []);
      setSeries(seriesResult.data ?? []);
      setRatings(ratingResult.data ?? []);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
      setAuthLoading(false);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setPageError(getErrorMessage(error));
      setUserEmail(data.session?.user.email ?? null);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail) {
      setPlatforms([]);
      setSeries([]);
      setRatings([]);
      setLoading(false);
      return;
    }
    void loadData();
  }, [loadData, userEmail]);

  const seriesById = useMemo(
    () => new Map(series.map((item) => [item.id, item])),
    [series],
  );
  const platformsById = useMemo(
    () => new Map(platforms.map((item) => [item.id, item])),
    [platforms],
  );

  async function saveEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editor) return;

    const formData = new FormData(event.currentTarget);
    setSaving(true);
    setPageError("");

    try {
      if (editor.kind === "platform") {
        const name = String(formData.get("name") ?? "").trim();
        const result = editor.record
          ? await supabase.from("platforms").update({ name }).eq("id", editor.record.id)
          : await supabase.from("platforms").insert({ name });
        if (result.error) throw result.error;
      } else if (editor.kind === "series") {
        const name = String(formData.get("name") ?? "").trim();
        const platform_id = String(formData.get("platform_id") ?? "");
        const result = editor.record
          ? await supabase
              .from("series")
              .update({ name, platform_id })
              .eq("id", editor.record.id)
          : await supabase.from("series").insert({ name, platform_id });
        if (result.error) throw result.error;
      } else {
        const platform_id = String(formData.get("platform_id") ?? "");
        const series_id = String(formData.get("series_id") ?? "");
        const score = Number(formData.get("score"));
        const observation = String(formData.get("observation") ?? "").trim();
        const values = { platform_id, series_id, score, observation };
        const result = editor.record
          ? await supabase.from("ratings").update(values).eq("id", editor.record.id)
          : await supabase.from("ratings").insert(values);
        if (result.error) throw result.error;
      }

      setEditor(null);
      await loadData();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(kind: Tab, id: string, label: string) {
    if (!supabase || !window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setPageError("");
    try {
      const table = kind === "platforms" ? "platforms" : kind === "series" ? "series" : "ratings";
      const result = await supabase.from(table).delete().eq("id", id);
      if (result.error) throw result.error;
      await loadData();
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setPageError(getErrorMessage(error));
  }

  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }

  if (authLoading) {
    return <main className="loading-screen"><LoaderCircle className="spin" size={25} /><span>Conectando con tu catálogo…</span></main>;
  }

  if (!userEmail) {
    return <AuthScreen onAuthenticated={() => setPageError("")} />;
  }

  const currentTitle = tabs.find((tab) => tab.id === activeTab)?.label ?? "Series";
  const activeCount =
    activeTab === "series" ? series.length : activeTab === "platforms" ? platforms.length : ratings.length;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Series, inicio">
          <span className="brand-mark"><Clapperboard size={23} /></span>
          <span>series<span className="brand-period">.</span></span>
        </a>
        <div className="sidebar-label">BIBLIOTECA</div>
        <nav className="main-nav" aria-label="Secciones">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-item ${activeTab === id ? "active" : ""}`}
              key={id}
              onClick={() => setActiveTab(id)}
              type="button"
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              <span className="nav-count">
                {id === "series" ? series.length : id === "platforms" ? platforms.length : ratings.length}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="connection-dot" />
          <span>Datos sincronizados</span>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Mi espacio <span>/</span> {currentTitle}</div>
          <div className="profile-chip"><span className="profile-avatar">{userEmail.slice(0, 1).toUpperCase()}</span><span>{userEmail}</span><button className="signout-button" onClick={() => void signOut()} type="button">Salir</button></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">TU COLECCIÓN PERSONAL</div>
              <h1>{currentTitle}</h1>
              <p className="page-description">
                {activeTab === "series" && "Organiza las series que estás viendo y las que quieres descubrir."}
                {activeTab === "platforms" && "Gestiona los servicios donde encuentras tus series favoritas."}
                {activeTab === "ratings" && "Guarda tus puntuaciones y lo que piensas de cada serie."}
              </p>
            </div>
            <button className="primary-button" onClick={() => setEditor({ kind: activeTab === "platforms" ? "platform" : activeTab === "series" ? "series" : "rating" })} type="button">
              <Plus size={18} />
              <span>{activeTab === "platforms" ? "Nueva plataforma" : activeTab === "series" ? "Nueva serie" : "Nueva valoración"}</span>
            </button>
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-icon purple"><Film size={19} /></span>
              <div><span className="stat-value">{series.length}</span><span className="stat-label">Series</span></div>
            </div>
            <div className="stat-card">
              <span className="stat-icon blue"><Tv size={19} /></span>
              <div><span className="stat-value">{platforms.length}</span><span className="stat-label">Plataformas</span></div>
            </div>
            <div className="stat-card">
              <span className="stat-icon amber"><Star size={19} /></span>
              <div><span className="stat-value">{ratings.length}</span><span className="stat-label">Valoraciones</span></div>
            </div>
          </div>

          {pageError && <div className="alert" role="alert"><CircleAlert size={18} /><span>{pageError}</span><button aria-label="Cerrar aviso" onClick={() => setPageError("")} type="button"><X size={16} /></button></div>}

          <div className="list-heading">
            <div>
              <h2>Todos los registros</h2>
              <span>{activeCount} {activeCount === 1 ? "registro" : "registros"}</span>
            </div>
          </div>

          <div className="data-card">
            {loading ? (
              <div className="loading-state"><LoaderCircle className="spin" size={24} /><span>Cargando tu catálogo…</span></div>
            ) : activeCount === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">{activeTab === "platforms" ? <Tv /> : activeTab === "series" ? <Film /> : <MessageSquareText />}</span>
                <h3>{activeTab === "platforms" ? "Aún no tienes plataformas" : activeTab === "series" ? "Tu catálogo empieza aquí" : "Todavía no hay valoraciones"}</h3>
                <p>{activeTab === "platforms" ? "Añade una plataforma para organizar tus series." : activeTab === "series" ? "Añade tu primera serie y asígnala a una plataforma." : "Cuando tengas una serie, puedes dejar tu primera opinión."}</p>
                <button className="secondary-button" onClick={() => setEditor({ kind: activeTab === "platforms" ? "platform" : activeTab === "series" ? "series" : "rating" })} type="button"><Plus size={16} />Crear registro</button>
              </div>
            ) : activeTab === "platforms" ? (
              <div className="platform-grid">
                {platforms.map((platform) => (
                  <article className="platform-card" key={platform.id}>
                    <span className="platform-logo"><Tv size={21} /></span>
                    <div className="platform-info"><h3>{platform.name}</h3><span>{series.filter((item) => item.platform_id === platform.id).length} series</span></div>
                    <RecordActions onEdit={() => setEditor({ kind: "platform", record: platform })} onDelete={() => void deleteRecord("platforms", platform.id, "esta plataforma")} />
                  </article>
                ))}
              </div>
            ) : activeTab === "series" ? (
              <div className="table-scroll"><table><thead><tr><th>SERIE</th><th>PLATAFORMA</th><th>VALORACIÓN</th><th className="actions-heading">ACCIONES</th></tr></thead>
                <tbody>{series.map((item) => {
                  const rating = ratings.find((entry) => entry.series_id === item.id);
                  return <tr key={item.id}>
                    <td><div className="series-cell"><span className="poster-icon"><Film size={18} /></span><span className="row-title">{item.name}</span></div></td>
                    <td><span className="platform-tag">{platformsById.get(item.platform_id)?.name ?? "Sin plataforma"}</span></td>
                    <td>{rating ? <span className="score-pill"><Star size={13} fill="currentColor" />{rating.score}<span className="score-outof">/10</span></span> : <span className="muted">Sin valorar</span>}</td>
                    <td><RecordActions onEdit={() => setEditor({ kind: "series", record: item })} onDelete={() => void deleteRecord("series", item.id, "esta serie")} /></td>
                  </tr>;
                })}</tbody></table></div>
            ) : (
              <div className="table-scroll"><table><thead><tr><th>SERIE</th><th>PLATAFORMA</th><th>PUNTAJE</th><th>OBSERVACIÓN</th><th className="actions-heading">ACCIONES</th></tr></thead>
                <tbody>{ratings.map((rating) => (
                  <tr key={rating.id}>
                    <td><div className="series-cell"><span className="poster-icon"><Film size={18} /></span><span className="row-title">{seriesById.get(rating.series_id)?.name ?? "Serie eliminada"}</span></div></td>
                    <td><span className="platform-tag">{platformsById.get(rating.platform_id)?.name ?? "Plataforma eliminada"}</span></td>
                    <td><span className="score-pill"><Star size={13} fill="currentColor" />{rating.score}<span className="score-outof">/10</span></span></td>
                    <td className="observation-cell" title={rating.observation}>{rating.observation}</td>
                    <td><RecordActions onEdit={() => setEditor({ kind: "rating", record: rating })} onDelete={() => void deleteRecord("ratings", rating.id, "esta valoración")} /></td>
                  </tr>
                ))}</tbody></table></div>
            )}
          </div>
          <footer className="page-footer"><Database size={14} /> Tu catálogo se guarda de forma segura en Supabase.</footer>
        </div>
      </section>

      {editor && (
        <EditorModal
          editor={editor}
          platforms={platforms}
          series={series}
          saving={saving}
          onClose={() => setEditor(null)}
          onSubmit={saveEditor}
        />
      )}
    </main>
  );
}

function RecordActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="row-actions">
      <button aria-label="Editar" className="icon-button" onClick={onEdit} title="Editar" type="button"><Pencil size={15} /></button>
      <button aria-label="Eliminar" className="icon-button delete" onClick={onDelete} title="Eliminar" type="button"><Trash2 size={15} /></button>
    </div>
  );
}

function EditorModal({
  editor,
  platforms,
  series,
  saving,
  onClose,
  onSubmit,
}: {
  editor: Editor;
  platforms: Platform[];
  series: Series[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [platformId, setPlatformId] = useState(
    editor.kind === "rating"
      ? editor.record?.platform_id ?? platforms[0]?.id ?? ""
      : editor.kind === "series"
        ? editor.record?.platform_id ?? platforms[0]?.id ?? ""
        : "",
  );
  const [selectedSeriesId, setSelectedSeriesId] = useState(
    editor.kind === "rating" ? editor.record?.series_id ?? "" : "",
  );
  const availableSeries = series.filter((item) => item.platform_id === platformId);
  const title =
    editor.kind === "platform"
      ? `${editor.record ? "Editar" : "Nueva"} plataforma`
      : editor.kind === "series"
        ? `${editor.record ? "Editar" : "Nueva"} serie`
        : `${editor.record ? "Editar" : "Nueva"} valoración`;

  function updatePlatform(value: string) {
    setPlatformId(value);
    if (editor.kind === "rating") {
      const firstSeries = series.find((item) => item.platform_id === value);
      setSelectedSeriesId(firstSeries?.id ?? "");
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="modal-title" aria-modal="true" className="modal" role="dialog">
        <div className="modal-header"><div><span className="modal-kicker">TU CATÁLOGO</span><h2 id="modal-title">{title}</h2></div><button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button"><X size={19} /></button></div>
        <form onSubmit={onSubmit}>
          {editor.kind === "platform" && (
            <label className="field-label">Nombre de la plataforma
              <input autoFocus defaultValue={editor.record?.name ?? ""} maxLength={100} name="name" placeholder="Ej. Netflix" required />
            </label>
          )}
          {editor.kind === "series" && (
            <>
              <label className="field-label">Nombre de la serie
                <input autoFocus defaultValue={editor.record?.name ?? ""} maxLength={150} name="name" placeholder="Ej. Stranger Things" required />
              </label>
              <label className="field-label">Plataforma
                <select defaultValue={platformId} name="platform_id" onChange={(event) => updatePlatform(event.target.value)} required>
                  <option value="" disabled>Selecciona una plataforma</option>
                  {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
                </select>
              </label>
              {platforms.length === 0 && <p className="form-hint">Primero necesitas crear una plataforma.</p>}
            </>
          )}
          {editor.kind === "rating" && (
            <>
              <label className="field-label">Plataforma
                <select value={platformId} name="platform_id" onChange={(event) => updatePlatform(event.target.value)} required>
                  <option value="" disabled>Selecciona una plataforma</option>
                  {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
                </select>
              </label>
              <label className="field-label">Serie
                <select value={selectedSeriesId} name="series_id" onChange={(event) => setSelectedSeriesId(event.target.value)} required>
                  <option value="" disabled>Selecciona una serie</option>
                  {availableSeries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="field-label">Puntaje <span className="field-note">del 1 al 10</span>
                <input defaultValue={editor.record?.score ?? 8} max="10" min="1" name="score" required type="number" />
              </label>
              <label className="field-label">Observación
                <textarea defaultValue={editor.record?.observation ?? ""} maxLength={2000} name="observation" placeholder="¿Qué te pareció esta serie?" required rows={4} />
              </label>
              {series.length === 0 && <p className="form-hint">Primero necesitas crear una serie.</p>}
            </>
          )}
          <div className="modal-actions"><button className="secondary-button" onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={saving || (editor.kind !== "platform" && platforms.length === 0) || (editor.kind === "rating" && availableSeries.length === 0)} type="submit">{saving && <LoaderCircle className="spin" size={16} />}{saving ? "Guardando…" : "Guardar"}</button></div>
        </form>
      </section>
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        onAuthenticated();
      } else {
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Cuenta creada. Revisa tu correo para confirmar el registro y luego inicia sesión.");
          setMode("login");
        } else {
          onAuthenticated();
        }
      }
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="setup-shell">
      <section className="setup-card auth-card">
        <a className="brand auth-brand" href="#"><span className="brand-mark"><Clapperboard size={23} /></span><span>series<span className="brand-period">.</span></span></a>
        <div className="eyebrow">TU COLECCIÓN PERSONAL</div>
        <h1>{mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h1>
        <p>Inicia sesión para administrar tus series, plataformas y valoraciones.</p>
        {error && <div className="alert auth-alert" role="alert"><CircleAlert size={17} /><span>{error}</span></div>}
        {message && <div className="success-message" role="status">{message}</div>}
        <form onSubmit={submit}>
          <label className="field-label">Correo electrónico
            <input autoComplete="email" name="email" placeholder="tu@correo.com" required type="email" />
          </label>
          <label className="field-label">Contraseña
            <input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} name="password" placeholder="Mínimo 6 caracteres" required type="password" />
          </label>
          <button className="primary-button auth-submit" disabled={busy} type="submit">{busy && <LoaderCircle className="spin" size={16} />}{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>
        </form>
        <p className="auth-switch">{mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes una cuenta?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }} type="button">{mode === "login" ? "Regístrate" : "Inicia sesión"}</button>
        </p>
      </section>
    </main>
  );
}

function SetupScreen() {
  return (
    <main className="setup-shell">
      <section className="setup-card">
        <span className="setup-icon"><Database size={25} /></span>
        <div className="eyebrow">CONFIGURACIÓN INICIAL</div>
        <h1>Conecta tu catálogo</h1>
        <p>La aplicación ya está lista. Para guardar tus datos de forma privada en Supabase, configura estas variables de entorno:</p>
        <pre><code>VITE_SUPABASE_URL=tu_url_de_supabase{"\n"}VITE_SUPABASE_ANON_KEY=tu_clave_anon</code></pre>
        <ol>
          <li>Crea un proyecto en Supabase, habilita registro e inicio de sesión por correo, y ejecuta el SQL de <code>supabase/migrations/</code>.</li>
          <li>Copia la URL del proyecto y la clave pública anon en el archivo <code>.env</code>.</li>
          <li>En Vercel, agrega las mismas variables en <strong>Settings → Environment Variables</strong> y vuelve a desplegar.</li>
        </ol>
        <p className="setup-note">Puedes usar <code>.env.example</code> como plantilla. No compartas ni subas claves privadas al repositorio.</p>
      </section>
    </main>
  );
}

export default App;
