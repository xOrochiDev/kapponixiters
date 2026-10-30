import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { demoActivity } from "@/lib/keyforge-demo";
import type { KeygenAuditEvent, KeygenProductTokenSummary, KeygenResource } from "@/server/keygen";

export const palette = {
  bg: "#060607",
  side: "#090A0C",
  surface: "#111214",
  raised: "#18191C",
  border: "#292B30",
  text: "#F1F1F3",
  muted: "#B3B5B9",
  faint: "#73767B",
  accent: "#E0E1E4",
  blue: "#C4C5C9",
  violet: "#A9AAB0",
  amber: "#B7B9BE",
  red: "#D0D1D4",
};

type IconName = ComponentProps<typeof Ionicons>["name"];

export type PanelProduct = {
  id: string;
  name: string;
  code: string;
  url: string;
  distributionStrategy: "LICENSED" | "OPEN" | "CLOSED";
  platform: string;
  licenses: number;
  active: number;
  color: string;
};

export type PanelLicense = {
  id: string;
  name: string;
  key: string;
  product: string;
  status: string;
  expires: string;
  machines: string;
  suspended: boolean;
};

export type PanelMachine = {
  id: string;
  name: string;
  platform: string;
  fingerprint: string;
  licenseName: string;
  productName: string;
  heartbeatStatus: string;
  requireHeartbeat: boolean;
  lastHeartbeat: string | null;
  created: string | null;
};

export function Surface({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.headingRow}>
      <View style={{ flex: 1, minWidth: 220 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {description ? <Text style={styles.pageDescription}>{description}</Text> : null}
      </View>
      {right ? <View style={styles.headingAction}>{right}</View> : null}
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  subtle = false,
  disabled = false,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  subtle?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        subtle ? styles.actionSubtle : styles.actionPrimary,
        disabled && styles.disabledButton,
        pressed && !disabled && { opacity: 0.82, transform: [{ scale: 0.99 }] },
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={subtle ? palette.text : palette.bg} /> : null}
      <Text style={[styles.actionText, subtle ? { color: palette.text } : { color: palette.bg }]}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "good" | "warn" | "bad" | "neutral" | "blue" }) {
  const tones = {
    good: { color: palette.accent, bg: "#282A2F", border: "#3D3F44" },
    warn: { color: palette.amber, bg: "#2C2D31", border: "#3D3F44" },
    bad: { color: palette.red, bg: "#27292D", border: "#4A4C52" },
    neutral: { color: "#BFC1C6", bg: "#212327", border: "#33353A" },
    blue: { color: palette.blue, bg: "#292B30", border: "#44464B" },
  };
  const color = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: color.bg, borderColor: color.border }]}>
      <View style={[styles.badgeDot, { backgroundColor: color.color }]} />
      <Text style={[styles.badgeText, { color: color.color }]}>{label}</Text>
    </View>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  color,
  wide,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
  color: string;
  wide: boolean;
}) {
  return (
    <Surface style={[styles.metricCard, { width: wide ? "23.5%" : "48.5%" }]}>
      <View style={styles.metricTop}>
        <Text style={styles.metricLabel}>{label}</Text>
        <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={17} color={color} />
        </View>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </Surface>
  );
}

function EmptyOrPreviewNote({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <View style={styles.previewNote}>
      <Ionicons name="information-circle-outline" size={17} color={palette.amber} />
      <Text style={styles.previewNoteText}>Datos de demostración · conecta Keygen para ver tus datos reales</Text>
    </View>
  );
}

export function OverviewSection({
  connected,
  products,
  licenses,
  wide,
  onCreateLicense,
  onGoToApps,
  onGoToActivity,
  onGoToIntegration,
  events,
  activityAvailable,
  activityLoading,
  activityIssue,
}: {
  connected: boolean;
  products: PanelProduct[];
  licenses: PanelLicense[];
  wide: boolean;
  onCreateLicense: () => void;
  onGoToApps: () => void;
  onGoToActivity: () => void;
  onGoToIntegration: () => void;
  events: KeygenAuditEvent[];
  activityAvailable: boolean;
  activityLoading: boolean;
  activityIssue?: string;
}) {
  const activeCount = licenses.filter((license) => !license.suspended && (license.status === "Activa" || license.status === "Por vencer")).length;
  const soonCount = licenses.filter((license) => license.status === "Por vencer" || license.status === "Expiring").length;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() - 6);
  startDay.setHours(0, 0, 0, 0);
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDay);
    date.setDate(startDay.getDate() + index);
    return date;
  });
  const activityCounts = chartDays.map((day) => events.filter((event) => {
    if (!event.created) return false;
    const created = new Date(event.created);
    return Number.isFinite(created.getTime()) && created.getFullYear() === day.getFullYear() && created.getMonth() === day.getMonth() && created.getDate() === day.getDate();
  }).length);
  const chartMax = connected ? Math.max(1, ...activityCounts) : 120;
  const liveChartAvailable = connected && activityAvailable && !activityLoading && !activityIssue;
  const chartTicks = connected ? [chartMax, Math.ceil(chartMax * 2 / 3), Math.ceil(chartMax / 3), 0] : [120, 80, 40, 0];
  return (
    <View style={styles.sectionStack}>
      <SectionHeading
        eyebrow="CENTRO DE CONTROL"
        title="Vista general"
        description="Una lectura rápida de tus productos, licencias y actividad."
        right={<ActionButton label="Generar clave" icon="add" onPress={onCreateLicense} />}
      />
      <EmptyOrPreviewNote connected={connected} />
      {!connected ? (
        <Pressable onPress={onGoToIntegration} style={styles.connectBanner}>
          <View style={styles.bannerIcon}><Ionicons name="link-outline" size={18} color={palette.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Conecta tu cuenta de Keygen</Text>
            <Text style={styles.bannerCopy}>Sincroniza productos y administra licencias desde un solo lugar.</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={palette.accent} />
        </Pressable>
      ) : null}
      <View style={styles.metricsWrap}>
        <MetricCard label="Aplicaciones" value={String(products.length).padStart(2, "0")} detail="Productos vinculados" icon="cube-outline" color={palette.accent} wide={wide} />
        <MetricCard label="Licencias" value={licenses.length.toLocaleString("es-MX")} detail="En todas tus aplicaciones" icon="key-outline" color={palette.blue} wide={wide} />
        <MetricCard label="Activas" value={activeCount.toLocaleString("es-MX")} detail="Con acceso vigente" icon="shield-checkmark-outline" color={palette.accent} wide={wide} />
        <MetricCard label="Por vencer" value={String(soonCount).padStart(2, "0")} detail="En los próximos días" icon="time-outline" color={palette.amber} wide={wide} />
      </View>
      <View style={[styles.twoColumns, !wide && { flexDirection: "column" }]}>
        <Surface style={[styles.chartCard, { flex: wide ? 1.45 : undefined }]}>
          <View style={styles.cardTitleRow}>
            <View>
              <Text style={styles.cardTitle}>Actividad del sistema</Text>
              <Text style={styles.cardCaption}>{connected ? "Eventos de auditoría de Keygen · últimos 7 días" : "Vista de muestra · conecta Keygen para ver datos reales"}</Text>
            </View>
            <StatusBadge label={!connected ? "Muestra" : activityLoading ? "Cargando" : activityIssue || !activityAvailable ? "Sin datos" : "En vivo"} tone={liveChartAvailable ? "good" : "neutral"} />
          </View>
          {liveChartAvailable || !connected ? <>
            <View style={styles.chartArea}>
              <View style={styles.chartAxis}>{chartTicks.map((count, index) => <Text key={`${count}-${index}`} style={styles.axisLabel}>{count}</Text>)}</View>
              <View style={styles.chartBars}>{(connected ? activityCounts : [42, 60, 49, 78, 55, 92, 68]).map((count, index) => {
                const height = connected ? (count === 0 ? 2 : Math.max(8, Math.round(count / chartMax * 96))) : count;
                return <View key={chartDays[index].toISOString()} style={styles.barGroup}><View style={[styles.bar, { height: `${height}%`, backgroundColor: index === 6 ? palette.accent : "#76787D" }]} /></View>;
              })}</View>
            </View>
            <View style={styles.chartDays}>{chartDays.map((date) => <Text key={date.toISOString()} style={styles.axisLabel}>{date.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "")}</Text>)}</View>
            <View style={styles.legendRow}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: palette.accent }]} /><Text style={styles.cardCaption}>{connected ? `${events.filter((event) => event.created && new Date(event.created) >= startDay && new Date(event.created) <= today).length} eventos recientes` : "Gráfico de muestra"}</Text></View></View>
          </> : <View style={styles.chartUnavailable}><Ionicons name={activityIssue ? "warning-outline" : "pulse-outline"} size={20} color={palette.muted} /><Text style={styles.emptyHint}>{activityLoading ? "Consultando Event Logs de Keygen…" : activityIssue ? activityIssue : activityAvailable ? "No hay eventos de auditoría en los últimos 7 días." : "Event Logs no está disponible en este ambiente de Keygen."}</Text></View>}
        </Surface>
        <Surface style={[styles.activityCard, { flex: 1 }]}>
          <View style={styles.cardTitleRow}>
            <View><Text style={styles.cardTitle}>Actividad reciente</Text><Text style={styles.cardCaption}>Eventos clave del sistema</Text></View>
            <Pressable onPress={onGoToActivity}><Text style={styles.linkText}>Ver todo</Text></Pressable>
          </View>
          {!connected ? demoActivity.slice(0, 4).map((item, index) => {
            const tone = item.kind === "success" ? palette.accent : item.kind === "warning" ? palette.amber : item.kind === "info" ? palette.blue : palette.muted;
            return <View key={`${item.title}-${index}`} style={styles.activityRow}><View style={[styles.activityIcon, { backgroundColor: `${tone}18` }]}><Ionicons name={item.kind === "success" ? "checkmark" : item.kind === "warning" ? "time-outline" : item.kind === "info" ? "cube-outline" : "remove"} size={14} color={tone} /></View><View style={{ flex: 1 }}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityDetail}>{item.detail}</Text></View><View style={[styles.activityLine, index === 3 && { opacity: 0 }]} /></View>;
          }) : activityLoading ? <Text style={styles.emptyHint}>Cargando eventos de Keygen…</Text> : activityIssue ? <Text style={styles.emptyHint}>{activityIssue}</Text> : !activityAvailable ? <Text style={styles.emptyHint}>Event Logs de Keygen requiere disponibilidad Beta y permiso event-log.read.</Text> : events.length ? events.slice(0, 4).map((event, index) => <AuditEventRow key={event.id} event={event} index={index} total={Math.min(events.length, 4)} compact />) : <Text style={styles.emptyHint}>No hay eventos recientes en este ambiente de Keygen.</Text>}
        </Surface>
      </View>
      <Surface>
        <View style={styles.cardTitleRow}>
          <View><Text style={styles.cardTitle}>Tus aplicaciones</Text><Text style={styles.cardCaption}>Productos que proteges con licencias</Text></View>
          <Pressable onPress={onGoToApps}><Text style={styles.linkText}>Administrar <Ionicons name="arrow-forward" size={12} color={palette.accent} /></Text></Pressable>
        </View>
        <ProductList products={products.slice(0, 3)} />
      </Surface>
    </View>
  );
}

function ProductList({ products }: { products: PanelProduct[] }) {
  if (!products.length) return <Text style={styles.emptyHint}>No hay productos visibles con la configuración actual.</Text>;
  return (
    <View>
      {products.map((product, index) => (
        <View key={product.id} style={[styles.productRow, index === 0 && { borderTopWidth: 0 }]}>
          <View style={[styles.productMark, { borderColor: `${product.color}72`, backgroundColor: `${product.color}16` }]}><Text style={[styles.productMarkText, { color: product.color }]}>{product.name.slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productMeta}>{product.code} · {product.platform}</Text></View>
          <View style={styles.productCounts}><Text style={styles.productCount}>{product.licenses}</Text><Text style={styles.productCountLabel}>licencias</Text></View>
          <View style={styles.productCounts}><Text style={[styles.productCount, { color: palette.accent }]}>{product.active}</Text><Text style={styles.productCountLabel}>activas</Text></View>
          <Ionicons name="chevron-forward" size={17} color={palette.faint} />
        </View>
      ))}
    </View>
  );
}

export function ApplicationsSection({
  products,
  connected,
  wide,
  onCreate,
  onManage,
}: {
  products: PanelProduct[];
  connected: boolean;
  wide: boolean;
  onCreate: () => void;
  onManage: (product: PanelProduct) => void;
}) {
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="CATÁLOGO" title="Aplicaciones" description="Administra los productos que proteges con Keygen." right={<ActionButton label="Nueva aplicación" icon="add" onPress={onCreate} />} />
      <EmptyOrPreviewNote connected={connected} />
      <View style={styles.appGrid}>
        {products.map((product) => (
          <Surface key={product.id} style={[styles.appCard, { width: wide ? "31.8%" : "100%" }]}>
            <View style={styles.appCardTop}>
              <View style={[styles.productMark, styles.largeMark, { borderColor: `${product.color}72`, backgroundColor: `${product.color}16` }]}><Text style={[styles.largeMarkText, { color: product.color }]}>{product.name.slice(0, 1).toUpperCase()}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Administrar ${product.name}`} disabled={!connected} onPress={() => onManage(product)} style={[styles.moreButton, !connected && { opacity: 0.45 }]}><Ionicons name="ellipsis-horizontal" size={18} color={palette.muted} /></Pressable>
            </View>
            <Text style={styles.appName}>{product.name}</Text>
            <Text style={styles.appCode}>{product.code}</Text>
            <Text style={styles.appPlatform}>{product.platform || "Plataforma no especificada"}</Text>
            <Text style={styles.appStrategy}>{product.distributionStrategy === "OPEN" ? "Descargas abiertas" : product.distributionStrategy === "CLOSED" ? "Descargas privadas" : "Acceso con licencia"}</Text>
            <View style={styles.appCardStats}>
              <View><Text style={styles.appStatValue}>{product.licenses}</Text><Text style={styles.appStatLabel}>Licencias</Text></View>
              <View><Text style={[styles.appStatValue, { color: palette.accent }]}>{product.active}</Text><Text style={styles.appStatLabel}>Activas</Text></View>
              <View><Text style={styles.appStatValue}>{product.licenses ? Math.round((product.active / product.licenses) * 100) : 0}%</Text><Text style={styles.appStatLabel}>Salud</Text></View>
            </View>
            <View style={styles.appFooter}><StatusBadge label={connected ? "Sincronizado" : "Demo"} tone={connected ? "good" : "neutral"} />{product.url ? <Text numberOfLines={1} style={styles.appUrl}>{product.url.replace(/^https?:\/\//, "")}</Text> : null}</View>
          </Surface>
        ))}
      </View>
      {!products.length ? <Surface><Text style={styles.emptyHint}>No hay aplicaciones para mostrar. Conecta Keygen o crea tu primer producto.</Text></Surface> : null}
      {!connected ? <Surface style={styles.noteCard}><Ionicons name="lock-closed-outline" size={18} color={palette.accent} /><Text style={styles.noteCardText}>La creación y edición remotas se habilitan al conectar una cuenta Keygen con permisos para productos.</Text></Surface> : null}
    </View>
  );
}

export function LicensesSection({
  licenses,
  connected,
  wide,
  onGenerate,
  onEdit,
  onToggle,
}: {
  licenses: PanelLicense[];
  connected: boolean;
  wide: boolean;
  onGenerate: () => void;
  onEdit: (license: PanelLicense) => void;
  onToggle: (license: PanelLicense) => void;
}) {
  const [searchText, setSearchText] = useLocalSearch();
  const [statusFilter, setStatusFilter] = useState("Todos");
  const statusOptions = ["Todos", "Activa", "Por vencer", "Suspendida", "Expirada", "Inactiva"];
  const filtered = licenses.filter((license) => `${license.name} ${license.key} ${license.product}`.toLowerCase().includes(searchText.toLowerCase()) && (statusFilter === "Todos" || license.status === statusFilter));
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="PROTECCIÓN" title="Licencias y keys" description="Consulta claves, límites de uso y estados de protección." right={<ActionButton label="Generar licencia" icon="key" onPress={onGenerate} />} />
      <EmptyOrPreviewNote connected={connected} />
      <Surface>
        <View style={styles.licenseToolbar}>
          <View style={styles.searchBox}><Ionicons name="search" size={16} color={palette.muted} /><SearchInput value={searchText} onChange={setSearchText} placeholder="Buscar licencia, clave o aplicación" /></View>
          <View style={styles.licenseFilterRow}>{statusOptions.map((status) => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: statusFilter === status }} onPress={() => setStatusFilter(status)} style={[styles.licenseFilterChip, statusFilter === status && styles.licenseFilterChipActive]}><Text style={[styles.licenseFilterChipText, statusFilter === status && styles.licenseFilterChipTextActive]}>{status}</Text></Pressable>)}</View>
        </View>
        {wide ? <LicenseTable licenses={filtered} onEdit={onEdit} onToggle={onToggle} connected={connected} /> : <LicenseCards licenses={filtered} onEdit={onEdit} onToggle={onToggle} connected={connected} />}
        {!filtered.length ? <Text style={styles.emptyHint}>No encontramos licencias con esa búsqueda.</Text> : null}
        <View style={styles.tableFooter}><Text style={styles.tableFootText}>{filtered.length} licencias {connected ? "sincronizadas" : "de demostración"}</Text><Text style={styles.tableFootText}>Los cambios remotos requieren una conexión válida.</Text></View>
      </Surface>
    </View>
  );
}

export function PoliciesSection({
  policies,
  products,
  connected,
  loading,
  wide,
  onCreate,
}: {
  policies: KeygenResource[];
  products: PanelProduct[];
  connected: boolean;
  loading: boolean;
  wide: boolean;
  onCreate: () => void;
}) {
  const [searchText, setSearchText] = useLocalSearch();
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const filtered = policies.filter((policy) => {
    const name = String(policy.attributes?.name ?? "");
    const productId = policy.relationships?.product?.data?.id ?? "";
    return `${name} ${productNames.get(productId) ?? ""}`.toLowerCase().includes(searchText.toLowerCase());
  });
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="REGLAS DE EMISIÓN" title="Policies" description="Consulta y crea límites, vencimientos y reglas que controlan tus licencias." right={<ActionButton label="Nueva policy" icon="add" onPress={onCreate} disabled={!connected || !products.length} />} />
      <EmptyOrPreviewNote connected={connected} />
      <Surface>
        <View style={styles.licenseToolbar}>
          <View style={styles.searchBox}><Ionicons name="search" size={16} color={palette.muted} /><SearchInput value={searchText} onChange={setSearchText} placeholder="Buscar policy o aplicación" /></View>
          <View style={styles.toolbarFilter}><Ionicons name="options-outline" size={14} color={palette.muted} /><Text style={styles.toolbarLabel}>{policies.length} policies</Text></View>
        </View>
        {loading ? <Text style={styles.emptyHint}>Cargando policies desde Keygen…</Text> : null}
        {!loading && !connected ? <Text style={styles.emptyHint}>Conecta Keygen para consultar las policies reales de tus productos.</Text> : null}
        {!loading && connected && filtered.length === 0 ? <Text style={styles.emptyHint}>No hay policies que coincidan con la búsqueda.</Text> : null}
        <View style={styles.policyGrid}>
          {filtered.map((policy) => {
            const attrs = policy.attributes ?? {};
            const productId = policy.relationships?.product?.data?.id ?? "";
            const maxMachines = typeof attrs.maxMachines === "number" ? attrs.maxMachines : null;
            const duration = typeof attrs.duration === "number" ? formatPolicyDuration(attrs.duration) : "Sin vencimiento";
            const scheme = typeof attrs.scheme === "string" ? attrs.scheme.replaceAll("_", " ") : "Clave estándar";
            return (
              <Surface key={policy.id} style={[styles.policyCard, { width: wide ? "48.8%" : "100%" }]}>
                <View style={styles.policyTop}><View style={styles.policyIcon}><Ionicons name="options-outline" size={17} color={palette.accent} /></View><StatusBadge label={attrs.strict ? "Estricto" : "Flexible"} tone={attrs.strict ? "warn" : "neutral"} /></View>
                <Text style={styles.policyTitle}>{String(attrs.name ?? "Policy sin nombre")}</Text>
                <Text style={styles.policySubtitle}>{productNames.get(productId) ?? "Producto Keygen"}</Text>
                <View style={styles.policyFacts}>
                  <View style={styles.policyFact}><Ionicons name="time-outline" size={14} color={palette.muted} /><Text style={styles.policyFactText}>{duration}</Text></View>
                  <View style={styles.policyFact}><Ionicons name="hardware-chip-outline" size={14} color={palette.muted} /><Text style={styles.policyFactText}>{maxMachines === null ? "Sin límite de equipos" : `${maxMachines} equipos máx.`}</Text></View>
                  <View style={styles.policyFact}><Ionicons name="key-outline" size={14} color={palette.muted} /><Text style={styles.policyFactText}>{scheme}</Text></View>
                </View>
                <View style={styles.policyFooter}><Text style={styles.tableFootText}>{attrs.floating ? "Flotante" : "Vinculada a equipo"}</Text><Text style={styles.tableFootText}>{attrs.requireHeartbeat ? "Heartbeat activo" : "Sin heartbeat"}</Text></View>
              </Surface>
            );
          })}
        </View>
      </Surface>
      <Surface style={styles.noteCard}><Ionicons name="information-circle-outline" size={18} color={palette.muted} /><Text style={styles.noteCardText}>Las policies se consultan desde Keygen. La emisión de licencias usa una policy elegida y no modifica sus reglas.</Text></Surface>
    </View>
  );
}

export function ApiTokensSection({
  products,
  productId,
  tokens,
  connected,
  loading,
  issue,
  onProductChange,
  onCreate,
  onRevoke,
}: {
  products: PanelProduct[];
  productId: string;
  tokens: KeygenProductTokenSummary[];
  connected: boolean;
  loading: boolean;
  issue?: string;
  onProductChange: (id: string) => void;
  onCreate: () => void;
  onRevoke: (token: KeygenProductTokenSummary) => void;
}) {
  const selectedProduct = products.find((product) => product.id === productId);
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="INTEGRACIÓN DE SOFTWARE" title="API keys y tokens" description="Emite credenciales de producto de Keygen para integrar tus aplicaciones desde un servidor." right={<ActionButton label="Crear API key" icon="key" onPress={onCreate} disabled={!connected || !products.length} />} />
      <EmptyOrPreviewNote connected={connected} />
      <View style={styles.tokenSecurityNotice}><Ionicons name="warning-outline" size={18} color={palette.text} /><View style={{ flex: 1 }}><Text style={styles.tokenNoticeTitle}>Secreto de servidor, no una clave para el frontend</Text><Text style={styles.tokenNoticeText}>Los tokens de producto conceden permisos sobre ese producto. Nunca los incrustes en APK, web o código cliente. Keygen solo muestra el secreto al generarlo; guárdalo en el backend/secret manager de tu app.</Text></View></View>
      {products.length ? <View style={styles.tokenProductPicker}><Text style={styles.fieldLabel}>PRODUCTO VINCULADO</Text><View style={styles.tokenProductChips}>{products.map((product) => <Pressable key={product.id} accessibilityRole="button" accessibilityState={{ selected: product.id === productId }} onPress={() => onProductChange(product.id)} style={[styles.tokenProductChip, product.id === productId && styles.tokenProductChipActive]}><Ionicons name="cube-outline" size={14} color={product.id === productId ? palette.text : palette.muted} /><Text style={[styles.tokenProductChipText, product.id === productId && styles.tokenProductChipTextActive]}>{product.name}</Text></Pressable>)}</View></View> : null}
      <Surface>
        <View style={styles.tokenListHeader}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{selectedProduct ? selectedProduct.name : "Credenciales"}</Text><Text style={styles.cardCaption}>Credenciales de producto registradas en Keygen · el secreto no se vuelve a mostrar</Text></View><StatusBadge label={`${tokens.length} tokens`} tone="neutral" /></View>
        {loading ? <Text style={styles.emptyHint}>Cargando credenciales de Keygen…</Text> : null}
        {issue ? <View style={styles.issueBox}><Ionicons name="warning-outline" size={17} color={palette.amber} /><Text style={styles.issueText}>{issue}</Text></View> : null}
        {!connected ? <Text style={styles.emptyHint}>Conecta Keygen para consultar o crear credenciales reales.</Text> : null}
        {connected && !loading && !issue && !tokens.length ? <View style={styles.connectedEmpty}><View style={styles.emptyIcon}><Ionicons name="key-outline" size={20} color={palette.muted} /></View><Text style={styles.cardTitle}>Todavía no hay tokens de producto</Text><Text style={styles.cardCaption}>Crea una credencial con permisos mínimos para enlazar un backend.</Text></View> : null}
        {tokens.map((token, index) => <View key={token.id} style={[styles.tokenRow, index === 0 && { borderTopWidth: 0 }]}><View style={styles.tokenRowIcon}><Ionicons name="key-outline" size={16} color={palette.muted} /></View><View style={{ flex: 1, minWidth: 120 }}><Text style={styles.policyTitle}>{token.name}</Text><Text style={styles.policySubtitle}>{token.permissions.length ? token.permissions.join(" · ") : "Permisos delegados por Keygen"}</Text><Text style={styles.tableFootText}>{token.kind.replaceAll("-", " ")} · {token.created ? new Date(token.created).toLocaleDateString("es-MX") : "Fecha no disponible"} · …{token.id.slice(-6)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Revocar ${token.name}`} onPress={() => onRevoke(token)} style={styles.tokenRevoke}><Ionicons name="ban-outline" size={14} color={palette.muted} /><Text style={styles.tokenRevokeText}>Revocar</Text></Pressable></View>)}
      </Surface>
    </View>
  );
}

export function MachinesSection({
  machines,
  connected,
  loading,
  issue,
  onDeactivate,
}: {
  machines: PanelMachine[];
  connected: boolean;
  loading: boolean;
  issue?: string;
  onDeactivate: (machine: PanelMachine) => void;
}) {
  const [searchText, setSearchText] = useLocalSearch();
  const filtered = machines.filter((machine) => `${machine.name} ${machine.platform} ${machine.productName} ${machine.licenseName} ${machine.fingerprint}`.toLowerCase().includes(searchText.toLowerCase()));
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="DISPOSITIVOS" title="Activaciones" description="Revisa los equipos que usan tus licencias y libera activaciones cuando haga falta." />
      <EmptyOrPreviewNote connected={connected} />
      {issue ? <View style={styles.issueBox}><Ionicons name="warning-outline" size={17} color={palette.amber} /><Text style={styles.issueText}>{issue}</Text></View> : null}
      <Surface>
        <View style={styles.licenseToolbar}>
          <View style={styles.searchBox}><Ionicons name="search" size={16} color={palette.muted} /><SearchInput value={searchText} onChange={setSearchText} placeholder="Buscar equipo, producto o licencia" /></View>
          <View style={styles.toolbarFilter}><Ionicons name="hardware-chip-outline" size={14} color={palette.muted} /><Text style={styles.toolbarLabel}>{machines.length} equipos</Text></View>
        </View>
        {loading ? <Text style={styles.emptyHint}>Cargando activaciones desde Keygen…</Text> : null}
        {!loading && !connected ? <Text style={styles.emptyHint}>Conecta Keygen para consultar activaciones reales.</Text> : null}
        {!loading && connected && filtered.length === 0 ? <View style={styles.connectedEmpty}><View style={styles.emptyIcon}><Ionicons name="laptop-outline" size={20} color={palette.muted} /></View><Text style={styles.cardTitle}>{machines.length ? "Sin resultados" : "Sin activaciones"}</Text><Text style={styles.cardCaption}>{machines.length ? "Prueba con otra búsqueda." : "No hay máquinas vinculadas en este ambiente de Keygen."}</Text></View> : null}
        {filtered.map((machine, index) => {
          const status = !machine.requireHeartbeat ? "ACTIVA" : machine.heartbeatStatus === "ALIVE" ? "EN LÍNEA" : machine.heartbeatStatus === "DEAD" ? "SIN SEÑAL" : machine.heartbeatStatus.replaceAll("_", " ");
          const tone = machine.heartbeatStatus === "DEAD" ? "bad" : machine.requireHeartbeat && machine.heartbeatStatus === "ALIVE" ? "good" : "neutral";
          return (
            <View key={machine.id} style={[styles.machineRow, index === 0 && { borderTopWidth: 0 }]}>
              <View style={styles.machineIcon}><Ionicons name="laptop-outline" size={17} color={palette.muted} /></View>
              <View style={{ flex: 1, minWidth: 110 }}><Text style={styles.policyTitle}>{machine.name}</Text><Text style={styles.policySubtitle}>{machine.platform} · {machine.productName}</Text><Text style={styles.machineFingerprint}>{machine.fingerprint} · {machine.licenseName}</Text></View>
              <View style={styles.machineActions}><StatusBadge label={status} tone={tone} /><Pressable accessibilityRole="button" onPress={() => onDeactivate(machine)} style={styles.machineDeactivate}><Ionicons name="trash-outline" size={14} color={palette.muted} /><Text style={styles.machineDeactivateText}>Desactivar</Text></Pressable></View>
            </View>
          );
        })}
      </Surface>
      <Surface style={styles.noteCard}><Ionicons name="warning-outline" size={18} color={palette.muted} /><Text style={styles.noteCardText}>Desactivar una máquina es irreversible: Keygen elimina el equipo y sus procesos/componentes asociados. El panel siempre pedirá confirmación antes de hacerlo.</Text></Surface>
    </View>
  );
}

function formatPolicyDuration(seconds: number): string {
  const days = Math.max(1, Math.round(seconds / 86_400));
  if (days % 365 === 0) return `${days / 365} ${days === 365 ? "año" : "años"}`;
  if (days % 30 === 0) return `${days / 30} ${days === 30 ? "mes" : "meses"}`;
  return `${days} ${days === 1 ? "día" : "días"}`;
}

function useLocalSearch(): [string, (value: string) => void] {
  return useState("");
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={palette.faint} style={styles.searchInput} />;
}

function LicenseTable({ licenses, onEdit, onToggle, connected }: { licenses: PanelLicense[]; onEdit: (license: PanelLicense) => void; onToggle: (license: PanelLicense) => void; connected: boolean }) {
  return (
    <View>
      <View style={styles.tableHead}>
        <Text style={[styles.tableHeadCell, { flex: 2.4 }]}>LICENCIA</Text><Text style={[styles.tableHeadCell, { flex: 1.3 }]}>APLICACIÓN</Text><Text style={[styles.tableHeadCell, { flex: 1.1 }]}>ESTADO</Text><Text style={[styles.tableHeadCell, { flex: 1 }]}>VENCE</Text><Text style={[styles.tableHeadCell, { flex: 0.8 }]}>MÁQUINAS</Text><Text style={{ width: 78 }} />
      </View>
      {licenses.map((license) => <LicenseRow key={license.id} license={license} onEdit={onEdit} onToggle={onToggle} connected={connected} />)}
    </View>
  );
}

function LicenseRow({ license, onEdit, onToggle, connected }: { license: PanelLicense; onEdit: (license: PanelLicense) => void; onToggle: (license: PanelLicense) => void; connected: boolean }) {
  const tone = license.status === "Activa" ? "good" : license.status === "Por vencer" ? "warn" : license.status === "Suspendida" ? "bad" : "neutral";
  return (
      <View style={styles.licenseRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${license.name}`} onPress={() => onEdit(license)} style={[styles.licenseIdentity, { flex: 2.4, minWidth: 150 }]}><Text style={styles.licenseName}>{license.name}</Text><Text style={styles.licenseKey}>{license.key}</Text></Pressable>
      <Text style={[styles.tableCell, { flex: 1.3 }]}>{license.product}</Text>
      <View style={{ flex: 1.1, alignItems: "flex-start" }}><StatusBadge label={license.status} tone={tone} /></View>
      <Text style={[styles.tableCell, { flex: 1 }]}>{license.expires}</Text>
      <Text style={[styles.tableCell, { flex: 0.8 }]}>{license.machines}</Text>
      <View style={styles.licenseActions}><Pressable accessibilityRole="button" accessibilityLabel={`Editar ${license.name}`} onPress={() => onEdit(license)} style={styles.rowAction}><Ionicons name="create-outline" size={16} color={palette.muted} /></Pressable>{connected ? <Pressable accessibilityRole="button" accessibilityLabel={license.suspended ? `Reactivar ${license.name}` : `Suspender ${license.name}`} onPress={() => onToggle(license)} style={styles.rowAction}><Ionicons name={license.suspended ? "play-outline" : "pause-outline"} size={16} color={palette.muted} /></Pressable> : null}</View>
    </View>
  );
}

function LicenseCards({ licenses, onEdit, onToggle, connected }: { licenses: PanelLicense[]; onEdit: (license: PanelLicense) => void; onToggle: (license: PanelLicense) => void; connected: boolean }) {
  return <View style={styles.licenseCards}>{licenses.map((license) => {
    const tone = license.status === "Activa" ? "good" : license.status === "Por vencer" ? "warn" : license.status === "Suspendida" ? "bad" : "neutral";
    return (
      <View key={license.id} style={styles.licenseMobileCard}>
        <View style={styles.cardTitleRow}><Pressable accessibilityRole="button" accessibilityLabel={`Editar ${license.name}`} onPress={() => onEdit(license)} style={{ flex: 1 }}><Text style={styles.licenseName}>{license.name}</Text><Text style={styles.licenseKey}>{license.key}</Text></Pressable><StatusBadge label={license.status} tone={tone} /></View>
        <View style={styles.mobileMetaRow}><Text style={styles.mobileMeta}>{license.product}</Text><Text style={styles.mobileMeta}>Vence {license.expires}</Text><Text style={styles.mobileMeta}>{license.machines} máquinas</Text></View>
        <View style={styles.mobileActionRow}><Pressable accessibilityRole="button" onPress={() => onEdit(license)} style={styles.mobileAction}><Ionicons name="create-outline" size={15} color={palette.accent} /><Text style={styles.mobileActionText}>Editar key</Text></Pressable>{connected ? <Pressable accessibilityRole="button" onPress={() => onToggle(license)} style={styles.mobileAction}><Ionicons name={license.suspended ? "play-outline" : "pause-outline"} size={15} color={palette.accent} /><Text style={styles.mobileActionText}>{license.suspended ? "Reactivar" : "Suspender"}</Text></Pressable> : null}</View>
      </View>
    );
  })}</View>;
}

export function SecuritySection({ connected, issue }: { connected: boolean; issue?: string }) {
  const cards = [
    { icon: "shield-checkmark-outline" as IconName, title: "Sesión del panel", body: "Acceso con cuenta Manus; la sesión se valida en el servidor.", state: "Protegida", tone: "good" as const },
    { icon: "key-outline" as IconName, title: "Token de Keygen", body: "La API usa el token en el servidor. Nunca se envía al navegador.", state: connected ? "Configurado" : "Pendiente", tone: connected ? "good" as const : "warn" as const },
    { icon: "lock-closed-outline" as IconName, title: "Transporte API", body: "Las solicitudes a Keygen se realizan por HTTPS.", state: "HTTPS", tone: "good" as const },
    { icon: "finger-print-outline" as IconName, title: "Permisos", body: "Las acciones de escritura requieren una sesión autorizada del panel.", state: "Controlados", tone: "blue" as const },
  ];
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="PROTECCIÓN" title="Seguridad" description="Capas de acceso y estado de la integración de licencias." />
      {!connected ? <EmptyOrPreviewNote connected={false} /> : null}
      {issue ? <View style={styles.issueBox}><Ionicons name="warning-outline" size={18} color={palette.amber} /><Text style={styles.issueText}>{issue}</Text></View> : null}
      <View style={styles.securityGrid}>{cards.map((card) => (
        <Surface key={card.title} style={styles.securityCard}>
          <View style={styles.securityCardTop}><View style={styles.securityIcon}><Ionicons name={card.icon} size={19} color={palette.accent} /></View><StatusBadge label={card.state} tone={card.tone} /></View>
          <Text style={styles.securityTitle}>{card.title}</Text><Text style={styles.securityBody}>{card.body}</Text>
        </Surface>
      ))}</View>
      <Surface style={styles.securityTip}>
        <View style={styles.tipIcon}><Ionicons name="information-circle-outline" size={19} color={palette.blue} /></View>
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Recomendación de Keygen</Text><Text style={styles.cardCaption}>Usa un token de entorno o de producto con permisos mínimos. Keygen recomienda no usar tokens de administrador para integraciones API.</Text></View>
      </Surface>
    </View>
  );
}

export function ActivitySection({ connected, events, loading, available, message, issue, onRefresh }: { connected: boolean; events: KeygenAuditEvent[]; loading: boolean; available: boolean; message?: string; issue?: string; onRefresh: () => void }) {
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="OBSERVABILIDAD" title="Actividad" description="Registro de auditoría de Keygen para licencias, aplicaciones y activaciones." right={<ActionButton label={loading ? "Actualizando…" : "Actualizar"} icon="refresh" onPress={onRefresh} subtle disabled={loading || !connected} />} />
      <EmptyOrPreviewNote connected={connected} />
      <Surface>
        {!connected ? demoActivity.map((item, index) => (
          <View key={`${item.title}-${index}`} style={styles.longActivityRow}>
            <View style={[styles.timelineMark, { backgroundColor: item.kind === "warning" ? palette.amber : item.kind === "success" ? palette.accent : palette.blue }]} />
            <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.activityDetail}>{item.detail}</Text></View>
            <Text style={styles.tableFootText}>Hoy</Text>
          </View>
        )) : loading ? <Text style={styles.emptyHint}>Consultando Event Logs de Keygen…</Text> : issue ? <View style={styles.issueBox}><Ionicons name="warning-outline" size={17} color={palette.amber} /><Text style={styles.issueText}>{issue}</Text></View> : !available ? <View style={styles.connectedEmpty}><View style={styles.emptyIcon}><Ionicons name="shield-outline" size={20} color={palette.muted} /></View><Text style={styles.cardTitle}>Registro no disponible</Text><Text style={styles.cardCaption}>{message || "Event Logs es una función Beta de Keygen y requiere el permiso event-log.read."}</Text></View> : events.length ? events.map((event, index) => <AuditEventRow key={event.id} event={event} index={index} total={events.length} />) : <View style={styles.connectedEmpty}><View style={styles.emptyIcon}><Ionicons name="pulse-outline" size={20} color={palette.accent} /></View><Text style={styles.cardTitle}>Sin eventos recientes</Text><Text style={styles.cardCaption}>Keygen no devolvió eventos para este ambiente.</Text></View>}
      </Surface>
    </View>
  );
}

function AuditEventRow({ event, index, total, compact = false }: { event: KeygenAuditEvent; index: number; total: number; compact?: boolean }) {
  const failed = /failed|revoked|suspended|deleted/i.test(event.event);
  const created = /created|succeeded|validated|activated/i.test(event.event);
  const tone = failed ? palette.amber : created ? palette.accent : palette.blue;
  const icon: IconName = failed ? "alert-circle-outline" : created ? "checkmark-circle-outline" : "pulse-outline";
  const title = formatAuditEvent(event.event);
  const resource = event.resourceType.replaceAll("-", " ").replace(/s$/, "");
  const detail = [resource, event.resourceId, event.actorType !== "system" ? `por ${event.actorType.replaceAll("-", " ")}` : "sistema"].filter(Boolean).join(" · ");
  const time = formatAuditTime(event.created);
  return compact ? (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: `${tone}18` }]}><Ionicons name={icon} size={14} color={tone} /></View>
      <View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.activityTitle}>{title}</Text><Text numberOfLines={1} style={styles.activityDetail}>{detail} · {time}</Text></View>
      {index < total - 1 ? <View style={styles.activityLine} /> : null}
    </View>
  ) : (
    <View style={styles.longActivityRow}>
      <View style={[styles.timelineMark, { backgroundColor: tone }]} />
      <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{title}</Text><Text style={styles.activityDetail}>{detail}</Text></View>
      <Text style={styles.tableFootText}>{time}</Text>
    </View>
  );
}

function formatAuditEvent(event: string): string {
  const labels: Record<string, string> = {
    "license.created": "Licencia creada",
    "license.updated": "Licencia actualizada",
    "license.suspended": "Licencia suspendida",
    "license.validation.failed": "Validación rechazada",
    "license.validation.succeeded": "Validación aprobada",
    "machine.created": "Activación registrada",
    "machine.deleted": "Activación eliminada",
    "product.created": "Aplicación creada",
    "product.updated": "Aplicación actualizada",
  };
  return labels[event] ?? event.replace(/[._]/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatAuditTime(value: string | null): string {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function IntegrationSection({
  connected,
  configured,
  issue,
  checking,
  onReconnect,
}: {
  connected: boolean;
  configured: boolean;
  issue?: string;
  checking: boolean;
  onReconnect: () => void;
}) {
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="CONEXIONES" title="Keygen" description="Conecta de forma segura el servicio que protege tus aplicaciones." right={<ActionButton label={checking ? "Verificando…" : "Verificar conexión"} icon="refresh" onPress={onReconnect} subtle={true} disabled={checking} />} />
      <Surface style={styles.integrationHero}>
        <View style={styles.integrationHeroTop}>
          <View style={styles.keygenGlyph}><View style={styles.glyphRing}><View style={styles.glyphCore} /></View><View style={styles.glyphTail} /></View>
          <View style={{ flex: 1 }}><Text style={styles.integrationName}>KEYGEN <Text style={{ color: palette.accent }}>API</Text></Text><Text style={styles.cardCaption}>Licencias · Productos · Políticas</Text></View>
          <StatusBadge label={connected ? "Conectado" : configured ? "Revisar acceso" : "Sin conectar"} tone={connected ? "good" : configured ? "warn" : "neutral"} />
        </View>
        <View style={styles.integrationDivider} />
        <Text style={styles.integrationCopy}>{connected ? "La API respondió correctamente. Los productos y licencias pueden consultarse desde el panel." : issue || "Aún no hay credenciales de Keygen configuradas. Cuando conectes una cuenta, sus secretos permanecerán en el servidor."}</Text>
        <View style={styles.integrationFacts}>
          <View style={styles.integrationFact}><Ionicons name="server-outline" size={16} color={palette.accent} /><Text style={styles.integrationFactText}>Token solo en servidor</Text></View>
          <View style={styles.integrationFact}><Ionicons name="lock-closed-outline" size={16} color={palette.accent} /><Text style={styles.integrationFactText}>API por HTTPS</Text></View>
          <View style={styles.integrationFact}><Ionicons name="sync-outline" size={16} color={palette.accent} /><Text style={styles.integrationFactText}>{connected ? "Sincronización disponible" : "Sincronización pendiente"}</Text></View>
        </View>
      </Surface>
      <View style={styles.stepsColumn}>
        <Surface style={styles.stepCard}><View style={[styles.stepNumber, configured && styles.stepDone]}><Text style={[styles.stepNumberText, configured && { color: palette.bg }]}>{configured ? "✓" : "01"}</Text></View><View style={{ flex: 1 }}><Text style={styles.securityTitle}>Configura acceso protegido</Text><Text style={styles.securityBody}>Usa el Account ID de Keygen y un token con permisos mínimos. Añade el token mediante el campo seguro del proyecto; no lo pegues en el código ni en el navegador.</Text></View></Surface>
        <Surface style={styles.stepCard}><View style={[styles.stepNumber, connected && styles.stepDone]}><Text style={[styles.stepNumberText, connected && { color: palette.bg }]}>{connected ? "✓" : "02"}</Text></View><View style={{ flex: 1 }}><Text style={styles.securityTitle}>Verifica permisos y ambiente</Text><Text style={styles.securityBody}>La primera verificación consulta productos. Si el token no tiene permisos suficientes, la pantalla indicará que hay que ajustar su alcance.</Text></View></Surface>
        <Surface style={styles.stepCard}><View style={[styles.stepNumber, connected && styles.stepDone]}><Text style={[styles.stepNumberText, connected && { color: palette.bg }]}>{connected ? "✓" : "03"}</Text></View><View style={{ flex: 1 }}><Text style={styles.securityTitle}>Administra productos y licencias</Text><Text style={styles.securityBody}>Para emitir una clave se requiere seleccionar una policy válida de Keygen. El panel no inventa policies ni confirma acciones remotas sin respuesta de la API.</Text></View></Surface>
      </View>
    </View>
  );
}

export function SettingsSection({ userEmail, connected, onLogout }: { userEmail?: string | null; connected: boolean; onLogout: () => void }) {
  return (
    <View style={styles.sectionStack}>
      <SectionHeading eyebrow="PREFERENCIAS" title="Ajustes" description="Tu perfil, la sesión y la conexión de este panel." />
      <Surface style={styles.settingsRow}><View style={styles.settingsIcon}><Ionicons name="person-outline" size={19} color={palette.accent} /></View><View style={{ flex: 1 }}><Text style={styles.securityTitle}>Cuenta del panel</Text><Text style={styles.securityBody}>{userEmail || "Sesión iniciada con Manus"}</Text></View><StatusBadge label="Manus OAuth" tone="blue" /></Surface>
      <Surface style={styles.settingsRow}><View style={styles.settingsIcon}><Ionicons name="cloud-outline" size={19} color={palette.blue} /></View><View style={{ flex: 1 }}><Text style={styles.securityTitle}>Conexión Keygen</Text><Text style={styles.securityBody}>{connected ? "Cuenta verificada desde el servidor" : "Credenciales pendientes de configuración"}</Text></View><StatusBadge label={connected ? "Activa" : "Pendiente"} tone={connected ? "good" : "warn"} /></Surface>
      <Pressable onPress={onLogout} style={styles.logoutButton}><Ionicons name="log-out-outline" size={17} color={palette.red} /><Text style={styles.logoutText}>Cerrar sesión</Text></Pressable>
    </View>
  );
}

const styles = {
  surface: { backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, padding: 18 } as const,
  headingRow: { flexDirection: "row" as const, alignItems: "flex-end" as const, justifyContent: "space-between" as const, gap: 16, marginBottom: 2, flexWrap: "wrap" as const },
  headingAction: { marginBottom: 3 },
  eyebrow: { color: palette.accent, fontSize: 10, letterSpacing: 1.8, fontWeight: "800" as const, marginBottom: 8 },
  pageTitle: { color: palette.text, fontSize: 29, fontWeight: "800" as const, letterSpacing: -0.8 },
  pageDescription: { color: palette.muted, fontSize: 13, marginTop: 7, lineHeight: 19 },
  sectionStack: { gap: 17 },
  actionButton: { minHeight: 40, borderRadius: 11, paddingHorizontal: 14, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  actionPrimary: { backgroundColor: palette.accent },
  actionSubtle: { backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.border },
  actionText: { fontSize: 12, fontWeight: "800" as const },
  disabledButton: { opacity: 0.52 },
  badge: { alignSelf: "flex-start" as const, flexDirection: "row" as const, gap: 6, alignItems: "center" as const, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 999 },
  badgeText: { fontSize: 9, fontWeight: "800" as const, letterSpacing: 0.2 },
  previewNote: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#232427", borderColor: "#3A3C41", borderWidth: 1, borderRadius: 10 },
  previewNoteText: { color: "#C6C7CB", fontSize: 11, fontWeight: "600" as const, flex: 1 },
  connectBanner: { backgroundColor: "#1B1C20", borderColor: "#3D3F44", borderWidth: 1, padding: 15, borderRadius: 14, flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
  bannerIcon: { width: 36, height: 36, borderRadius: 11, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#292B2F" },
  bannerTitle: { color: palette.text, fontSize: 13, fontWeight: "800" as const },
  bannerCopy: { color: "#B9BABE", fontSize: 11, marginTop: 3, lineHeight: 16 },
  metricsWrap: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 10 },
  metricCard: { minHeight: 122, padding: 15 },
  metricTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
  metricLabel: { color: palette.muted, fontSize: 11, fontWeight: "600" as const },
  metricIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center" as const, justifyContent: "center" as const },
  metricValue: { color: palette.text, fontSize: 27, fontWeight: "800" as const, letterSpacing: -1, marginTop: 10 },
  metricDetail: { color: palette.faint, fontSize: 10, marginTop: 3 },
  twoColumns: { flexDirection: "row" as const, gap: 14 },
  chartCard: { minHeight: 290 },
  activityCard: { minHeight: 290 },
  cardTitleRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10 },
  cardTitle: { color: palette.text, fontSize: 14, fontWeight: "800" as const },
  cardCaption: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
  chartArea: { height: 155, flexDirection: "row" as const, marginTop: 22, gap: 10 },
  chartAxis: { justifyContent: "space-between" as const, paddingBottom: 2 },
  axisLabel: { color: palette.faint, fontSize: 9 },
  chartBars: { flex: 1, flexDirection: "row" as const, alignItems: "flex-end" as const, justifyContent: "space-around" as const, borderBottomWidth: 1, borderBottomColor: palette.border, borderTopWidth: 1, borderTopColor: "#27292E", borderStyle: "dashed" as const },
  barGroup: { width: "8%" as const, height: "100%" as const, flexDirection: "row" as const, alignItems: "flex-end" as const, justifyContent: "center" as const, gap: 3 },
  bar: { width: "45%" as const, minHeight: 7, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barGhost: { width: "35%" as const, backgroundColor: "#3A3C41", minHeight: 7, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartDays: { flexDirection: "row" as const, justifyContent: "space-around" as const, marginLeft: 29, marginTop: 8 },
  legendRow: { flexDirection: "row" as const, gap: 18, marginTop: 14 },
  legendItem: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  legendDot: { width: 6, height: 6, borderRadius: 99 },
  chartUnavailable: { height: 190, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 24 },
  linkText: { color: palette.accent, fontSize: 11, fontWeight: "700" as const },
  activityRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingVertical: 12, position: "relative" as const },
  activityIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center" as const, justifyContent: "center" as const },
  activityTitle: { color: palette.text, fontSize: 11, fontWeight: "700" as const },
  activityDetail: { color: palette.muted, fontSize: 10, marginTop: 4 },
  activityLine: { position: "absolute" as const, width: 1, height: 13, backgroundColor: palette.border, left: 14, bottom: -1 },
  emptyHint: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 16 },
  productRow: { borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 13, gap: 12 },
  productMark: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: "center" as const, justifyContent: "center" as const },
  productMarkText: { fontSize: 15, fontWeight: "800" as const },
  productName: { color: palette.text, fontSize: 12, fontWeight: "700" as const },
  productMeta: { color: palette.muted, fontSize: 10, marginTop: 4 },
  productCounts: { alignItems: "flex-end" as const, minWidth: 48 },
  productCount: { color: palette.text, fontSize: 12, fontWeight: "800" as const },
  productCountLabel: { color: palette.faint, fontSize: 9, marginTop: 3 },
  appGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 12 },
  appCard: { minHeight: 255 },
  appCardTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const },
  largeMark: { width: 48, height: 48, borderRadius: 15 },
  largeMarkText: { fontSize: 20, fontWeight: "800" as const },
  moreButton: { width: 30, height: 30, borderRadius: 9, backgroundColor: palette.raised, alignItems: "center" as const, justifyContent: "center" as const },
  appName: { color: palette.text, fontSize: 16, fontWeight: "800" as const, marginTop: 15 },
  appCode: { color: palette.muted, fontSize: 10, marginTop: 4, fontFamily: "monospace" },
  appPlatform: { color: palette.muted, fontSize: 10, marginTop: 8 },
  appStrategy: { color: palette.faint, fontSize: 9, marginTop: 4 },
  appCardStats: { flexDirection: "row" as const, justifyContent: "space-between" as const, borderTopWidth: 1, borderTopColor: palette.border, borderBottomWidth: 1, borderBottomColor: palette.border, marginTop: 16, paddingVertical: 11 },
  appStatValue: { color: palette.text, fontSize: 13, fontWeight: "800" as const },
  appStatLabel: { color: palette.faint, fontSize: 9, marginTop: 3 },
  appFooter: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 13, gap: 8 },
  appUrl: { color: palette.faint, fontSize: 9, flexShrink: 1 },
  noteCard: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingVertical: 13 },
  noteCardText: { color: palette.muted, fontSize: 11, lineHeight: 17, flex: 1 },
  licenseToolbar: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 9, marginBottom: 15 },
  licenseFilterRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, alignItems: "center" as const, gap: 5 },
  licenseFilterChip: { minHeight: 30, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.bg, justifyContent: "center" as const },
  licenseFilterChipActive: { borderColor: "#696B70", backgroundColor: "#27292D" },
  licenseFilterChipText: { color: palette.muted, fontSize: 9, fontWeight: "700" as const },
  licenseFilterChipTextActive: { color: palette.text },
  searchBox: { flex: 1, minWidth: 190, height: 38, borderWidth: 1, borderColor: palette.border, borderRadius: 10, backgroundColor: palette.bg, flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 11, gap: 8 },
  searchInput: { flex: 1, color: palette.text, fontSize: 11, outlineStyle: "none" as any, paddingVertical: 7 },
  toolbarFilter: { minHeight: 38, flexDirection: "row" as const, alignItems: "center" as const, gap: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 11, backgroundColor: palette.bg },
  toolbarLabel: { color: palette.muted, fontSize: 10 },
  tableHead: { flexDirection: "row" as const, alignItems: "center" as const, borderTopWidth: 1, borderTopColor: palette.border, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: 10 },
  tableHeadCell: { color: palette.faint, fontSize: 9, fontWeight: "800" as const, letterSpacing: 0.8 },
  licenseRow: { minHeight: 60, flexDirection: "row" as const, alignItems: "center" as const, borderBottomWidth: 1, borderBottomColor: palette.border, gap: 9 },
  licenseIdentity: { paddingVertical: 8, cursor: "pointer" as any },
  licenseName: { color: palette.text, fontSize: 11, fontWeight: "700" as const },
  licenseKey: { color: palette.faint, fontSize: 9, marginTop: 4, fontFamily: "monospace" },
  tableCell: { color: palette.muted, fontSize: 10 },
  licenseActions: { width: 78, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "flex-end" as const },
  rowAction: { width: 42, alignItems: "center" as const, justifyContent: "center" as const },
  tableFooter: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 8, marginTop: 12 },
  tableFootText: { color: palette.faint, fontSize: 9 },
  licenseCards: { gap: 9 },
  licenseMobileCard: { borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 14, gap: 12 },
  mobileMetaRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  mobileMeta: { color: palette.muted, fontSize: 10 },
  mobileActionRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  mobileAction: { alignSelf: "flex-start" as const, flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#282A2F", borderRadius: 8 },
  mobileActionText: { color: palette.accent, fontSize: 10, fontWeight: "700" as const },
  securityGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 12 },
  securityCard: { width: "48.5%" as const, minHeight: 160 },
  securityCardTop: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: 20 },
  securityIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#222427", alignItems: "center" as const, justifyContent: "center" as const },
  securityTitle: { color: palette.text, fontSize: 12, fontWeight: "800" as const },
  securityBody: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
  securityTip: { flexDirection: "row" as const, gap: 11, alignItems: "flex-start" as const },
  tipIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: "#292B30", alignItems: "center" as const, justifyContent: "center" as const },
  issueBox: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, borderWidth: 1, borderColor: "#3A3C41", backgroundColor: "#232427", borderRadius: 10, padding: 12 },
  issueText: { color: "#C6C7CB", fontSize: 11, lineHeight: 17, flex: 1 },
  longActivityRow: { minHeight: 74, borderBottomWidth: 1, borderBottomColor: palette.border, flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
  timelineMark: { width: 8, height: 8, borderRadius: 99 },
  connectedEmpty: { paddingVertical: 40, alignItems: "center" as const, gap: 8 },
  emptyIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#222427", marginBottom: 6 },
  integrationHero: { padding: 20 },
  integrationHeroTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: 14 },
  keygenGlyph: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#27292D", alignItems: "center" as const, justifyContent: "center" as const, position: "relative" as const },
  glyphRing: { width: 21, height: 21, borderRadius: 99, borderWidth: 3, borderColor: palette.accent, alignItems: "center" as const, justifyContent: "center" as const },
  glyphCore: { width: 7, height: 7, borderRadius: 99, backgroundColor: palette.accent },
  glyphTail: { position: "absolute" as const, width: 14, height: 4, backgroundColor: palette.accent, right: 5, top: 26, borderRadius: 3, transform: [{ rotate: "-45deg" }] },
  integrationName: { color: palette.text, fontSize: 14, fontWeight: "900" as const, letterSpacing: 1.4 },
  integrationDivider: { height: 1, backgroundColor: palette.border, marginVertical: 17 },
  integrationCopy: { color: palette.muted, fontSize: 12, lineHeight: 19 },
  integrationFacts: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 14, marginTop: 17 },
  integrationFact: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  integrationFactText: { color: "#D0D1D4", fontSize: 10 },
  stepsColumn: { gap: 10 },
  stepCard: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 14 },
  stepNumber: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised, alignItems: "center" as const, justifyContent: "center" as const },
  stepDone: { backgroundColor: palette.accent, borderColor: palette.accent },
  stepNumberText: { color: palette.muted, fontSize: 10, fontWeight: "900" as const },
  settingsRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
  settingsIcon: { width: 37, height: 37, borderRadius: 11, backgroundColor: palette.raised, alignItems: "center" as const, justifyContent: "center" as const },
  logoutButton: { minHeight: 45, alignSelf: "flex-start" as const, paddingHorizontal: 13, borderWidth: 1, borderColor: "#4A4C52", backgroundColor: "#222327", borderRadius: 11, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  logoutText: { color: palette.red, fontSize: 11, fontWeight: "700" as const },
  policyGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const, gap: 12, marginTop: 12 },
  policyCard: { minHeight: 205 },
  policyTop: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  policyIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: palette.raised, alignItems: "center" as const, justifyContent: "center" as const },
  policyTitle: { color: palette.text, fontSize: 12, fontWeight: "800" as const, marginTop: 12 },
  policySubtitle: { color: palette.muted, fontSize: 10, marginTop: 4 },
  policyFacts: { gap: 9, marginTop: 15 },
  policyFact: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  policyFactText: { color: palette.muted, fontSize: 10 },
  policyFooter: { flexDirection: "row" as const, justifyContent: "space-between" as const, gap: 8, borderTopWidth: 1, borderTopColor: palette.border, marginTop: 13, paddingTop: 10 },
  machineRow: { minHeight: 81, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 12 },
  machineIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: palette.raised, alignItems: "center" as const, justifyContent: "center" as const },
  machineFingerprint: { color: palette.faint, fontSize: 9, fontFamily: "monospace", marginTop: 5 },
  machineActions: { alignItems: "flex-end" as const, gap: 7 },
  machineDeactivate: { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, paddingVertical: 5, paddingHorizontal: 7, borderWidth: 1, borderColor: palette.border, borderRadius: 7 },
  machineDeactivateText: { color: palette.muted, fontSize: 9, fontWeight: "700" as const },
  fieldLabel: { color: "#C3C4C8", fontSize: 9, fontWeight: "800" as const, letterSpacing: 0.8 },
  tokenSecurityNotice: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 11, borderWidth: 1, borderColor: "#414348", backgroundColor: "#151619", borderRadius: 12, padding: 14 },
  tokenNoticeTitle: { color: palette.text, fontSize: 11, fontWeight: "800" as const },
  tokenNoticeText: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  tokenProductPicker: { gap: 9 },
  tokenProductChips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
  tokenProductChip: { minHeight: 36, flexDirection: "row" as const, alignItems: "center" as const, gap: 7, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  tokenProductChipActive: { backgroundColor: "#292B30", borderColor: "#505258" },
  tokenProductChipText: { color: palette.muted, fontSize: 10, fontWeight: "700" as const },
  tokenProductChipTextActive: { color: palette.text },
  tokenListHeader: { minHeight: 48, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12, marginBottom: 8 },
  tokenRow: { minHeight: 77, flexDirection: "row" as const, alignItems: "center" as const, gap: 11, borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 12 },
  tokenRowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: palette.raised, alignItems: "center" as const, justifyContent: "center" as const },
  tokenRevoke: { minHeight: 32, flexDirection: "row" as const, alignItems: "center" as const, gap: 5, paddingHorizontal: 9, borderWidth: 1, borderColor: palette.border, borderRadius: 8 },
  tokenRevokeText: { color: palette.muted, fontSize: 9, fontWeight: "700" as const },
};
