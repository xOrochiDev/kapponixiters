import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { demoLicenses, demoProducts } from "@/lib/keyforge-demo";
import { trpc } from "@/lib/trpc";
import type { KeygenAuditEvent, KeygenProductTokenSummary, KeygenResource } from "@/server/keygen";
import {
  ActionButton,
  ApiTokensSection,
  ActivitySection,
  ApplicationsSection,
  IntegrationSection,
  LicensesSection,
  MachinesSection,
  OverviewSection,
  PoliciesSection,
  palette,
  SecuritySection,
  SettingsSection,
  StatusBadge,
  type PanelLicense,
  type PanelMachine,
  type PanelProduct,
} from "@/components/keyforge/sections";

type Section = "overview" | "applications" | "licenses" | "policies" | "machines" | "tokens" | "security" | "activity" | "integration" | "settings";
type ModalKind = "product" | "edit-product" | "confirm-product-strategy" | "license" | "policy" | "api-token" | "token-result" | "confirm-token" | "connection" | "result" | "confirm-license" | "confirm-machine" | "edit-license" | "change-policy" | "confirm-usage" | null;
type LicenseEditorDraft = {
  name: string;
  expiry: string;
  maxMachines: string;
  maxProcesses: string;
  maxUsers: string;
  maxCores: string;
  maxMemory: string;
  maxDisk: string;
  maxUses: string;
  permissions: string;
  metadata: string;
  protected: boolean;
};

const navigation: { id: Section; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "overview", label: "Vista general", icon: "grid-outline" },
  { id: "applications", label: "Aplicaciones", icon: "cube-outline" },
  { id: "licenses", label: "Licencias y keys", icon: "key-outline" },
  { id: "policies", label: "Policies", icon: "options-outline" },
  { id: "machines", label: "Activaciones", icon: "laptop-outline" },
  { id: "tokens", label: "API keys y tokens", icon: "key-outline" },
  { id: "security", label: "Seguridad", icon: "shield-checkmark-outline" },
  { id: "activity", label: "Actividad", icon: "pulse-outline" },
  { id: "integration", label: "Conexión Keygen", icon: "link-outline" },
  { id: "settings", label: "Ajustes", icon: "settings-outline" },
];

const productColors = [palette.accent, palette.blue, palette.violet, palette.amber, "#8B8D92"];
const alkaponeAvatar = require("../../assets/images/alkapone-avatar.jpeg");

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 1060;
  const compact = width < 660;
  const { user, loading, isAuthenticated, refresh, logout } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [modalError, setModalError] = useState("");
  const [form, setForm] = useState({ productName: "", productCode: "", productUrl: "", licenseName: "", policyId: "", maxMachines: "1" });
  const [licenseNameMode, setLicenseNameMode] = useState<"random" | "custom">("custom");
  const [licenseProductId, setLicenseProductId] = useState("");
  const [licenseExpiryMode, setLicenseExpiryMode] = useState<"policy" | "never" | "custom">("policy");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [licenseMaxUses, setLicenseMaxUses] = useState("");
  const [licenseReference, setLicenseReference] = useState("");
  const [productPlatforms, setProductPlatforms] = useState("");
  const [productStrategy, setProductStrategy] = useState<"LICENSED" | "OPEN" | "CLOSED">("LICENSED");
  const [pendingProduct, setPendingProduct] = useState<PanelProduct | null>(null);
  const [productDraft, setProductDraft] = useState({ name: "", code: "", url: "", platforms: "", distributionStrategy: "LICENSED" as PanelProduct["distributionStrategy"] });
  const [policyDraft, setPolicyDraft] = useState({ name: "", productId: "", durationMode: "unlimited" as "unlimited" | "custom", durationDays: "30", maxMachines: "", maxUses: "", floating: false, strict: false, requireHeartbeat: false, requireCheckIn: false, checkInInterval: "day" as "day" | "week" | "month" | "year", checkInIntervalCount: "1", authenticationStrategy: "LICENSE" as "TOKEN" | "LICENSE" | "MIXED" | "NONE", expirationBasis: "FROM_CREATION" as "FROM_CREATION" | "FROM_FIRST_VALIDATION" | "FROM_FIRST_ACTIVATION", scheme: "" as "" | "ED25519_SIGN" });
  const [tokenProductId, setTokenProductId] = useState("");
  const [tokenDraft, setTokenDraft] = useState({ name: "", permissions: ["license.validate", "machine.create"] as string[] });
  const [tokenExpiry, setTokenExpiry] = useState("");
  const [tokenSecret, setTokenSecret] = useState("");
  const [tokenSecretName, setTokenSecretName] = useState("");
  const [pendingToken, setPendingToken] = useState<KeygenProductTokenSummary | null>(null);
  const [resultKey, setResultKey] = useState("");
  const [resultLicenseName, setResultLicenseName] = useState("");
  const [pendingLicense, setPendingLicense] = useState<PanelLicense | null>(null);
  const [pendingMachine, setPendingMachine] = useState<PanelMachine | null>(null);
  const [licenseDraft, setLicenseDraft] = useState<LicenseEditorDraft | null>(null);
  const [policyTargetId, setPolicyTargetId] = useState("");
  const [pendingUsageAction, setPendingUsageAction] = useState<"increment" | "decrement" | "reset" | null>(null);
  const [modalNotice, setModalNotice] = useState("");
  const [loginIssue, setLoginIssue] = useState("");
  const [loginNotice, setLoginNotice] = useState("");

  const statusQuery = trpc.keygen.status.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const connected = Boolean(statusQuery.data?.connected);
  const productsQuery = trpc.keygen.products.useQuery(undefined, {
    enabled: isAuthenticated && connected,
    retry: false,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const connectedProducts = productsQuery.data ?? [];
  const selectedTokenProductId = connectedProducts.some((product) => product.id === tokenProductId)
    ? tokenProductId
    : connectedProducts[0]?.id ?? "";
  const selectedLicenseProductId = connectedProducts.some((product) => product.id === licenseProductId)
    ? licenseProductId
    : connectedProducts[0]?.id ?? "";
  const licensesQuery = trpc.keygen.licenses.useQuery(undefined, {
    enabled: isAuthenticated && connected,
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const policiesQuery = trpc.keygen.policies.useQuery(
    {},
    { enabled: isAuthenticated && connected && (modal === "license" || modal === "edit-license" || modal === "change-policy" || modal === "policy" || section === "policies"), retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const productTokensQuery = trpc.keygen.productTokens.useQuery(
    { productId: selectedTokenProductId },
    { enabled: isAuthenticated && connected && section === "tokens" && Boolean(selectedTokenProductId), retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true },
  );
  const licenseDetailsQuery = trpc.keygen.licenseDetails.useQuery(
    { id: pendingLicense?.id ?? "" },
    { enabled: isAuthenticated && connected && modal === "edit-license" && Boolean(pendingLicense?.id), retry: false },
  );
  const machinesQuery = trpc.keygen.machines.useQuery(undefined, {
    enabled: isAuthenticated && connected && section === "machines",
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const auditQuery = trpc.keygen.events.useQuery(undefined, {
    enabled: isAuthenticated && connected && (section === "overview" || section === "activity"),
    retry: false,
    refetchInterval: (query) => query.state.data?.available === false ? false : 15_000,
    refetchOnWindowFocus: true,
  });
  const createProduct = trpc.keygen.createProduct.useMutation();
  const updateProduct = trpc.keygen.updateProduct.useMutation();
  const validateLoginKey = trpc.keygen.validateLicenseKey.useMutation({ gcTime: 0 });
  const createPolicy = trpc.keygen.createPolicy.useMutation();
  const createLicense = trpc.keygen.createLicense.useMutation({ gcTime: 0 });
  const createProductToken = trpc.keygen.createProductToken.useMutation();
  const revokeToken = trpc.keygen.revokeToken.useMutation();
  const updateLicense = trpc.keygen.updateLicense.useMutation();
  const changeLicensePolicy = trpc.keygen.changeLicensePolicy.useMutation();
  const setLicenseUsage = trpc.keygen.setLicenseUsage.useMutation();
  const setSuspended = trpc.keygen.setLicenseSuspended.useMutation();
  const deactivateMachineMutation = trpc.keygen.deactivateMachine.useMutation();

  const pendingLicenseId = pendingLicense?.id ?? "";
  useEffect(() => {
    const details = licenseDetailsQuery.data;
    if (!details || !pendingLicenseId || details.id !== pendingLicenseId || modal !== "edit-license") return;
    // Hydrate the editable form draft after the protected details query resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLicenseDraft({
      name: details.name,
      expiry: details.expiry ? details.expiry.slice(0, 10) : "",
      maxMachines: details.maxMachines === null ? "" : String(details.maxMachines),
      maxProcesses: details.maxProcesses === null ? "" : String(details.maxProcesses),
      maxUsers: details.maxUsers === null ? "" : String(details.maxUsers),
      maxCores: details.maxCores === null ? "" : String(details.maxCores),
      maxMemory: details.maxMemory === null ? "" : String(details.maxMemory),
      maxDisk: details.maxDisk === null ? "" : String(details.maxDisk),
      maxUses: details.maxUses === null ? "" : String(details.maxUses),
      permissions: details.permissions.join("\n"),
      metadata: JSON.stringify(details.metadata, null, 2),
      protected: details.protected,
    });
    setModalNotice("");
  }, [licenseDetailsQuery.data, modal, pendingLicenseId]);

  const connectedLicenses = licensesQuery.data ?? [];
  const displayProducts = connected
    ? makeProducts(connectedProducts, connectedLicenses)
    : demoProducts.map((product) => ({ ...product, url: "", distributionStrategy: "LICENSED" as const, platform: product.platform }));
  const displayLicenses = connected
    ? makeLicenses(connectedLicenses)
    : demoLicenses.map((license) => ({ ...license, suspended: license.status === "Suspendida" }));
  const connectionIssue = statusQuery.data?.message ?? (statusQuery.error ? "No fue posible verificar Keygen con la sesión actual." : undefined);

  const closeModal = () => {
    setModal(null);
    setModalError("");
    setModalNotice("");
    setPendingLicense(null);
    setPendingMachine(null);
    setPendingProduct(null);
    setLicenseDraft(null);
    setPolicyTargetId("");
    setPendingUsageAction(null);
    setResultKey("");
    setTokenSecret("");
    setTokenSecretName("");
    setPendingToken(null);
  };

  const openCreateLicense = () => {
    if (!connected) {
      setModal("connection");
      return;
    }
    setModalError("");
    setForm((previous) => ({ ...previous, licenseName: "", policyId: "", maxMachines: "1" }));
    setLicenseProductId(connectedProducts[0]?.id ?? "");
    setLicenseNameMode("custom");
    setLicenseExpiryMode("policy");
    setLicenseExpiry("");
    setLicenseMaxUses("");
    setLicenseReference("");
    setModal("license");
  };

  const openCreateProduct = () => {
    if (!connected) {
      setModal("connection");
      return;
    }
    setModalError("");
    setForm((previous) => ({ ...previous, productName: "", productCode: "", productUrl: "" }));
    setProductPlatforms("");
    setProductStrategy("LICENSED");
    setModal("product");
  };

  const openEditProduct = (product: PanelProduct) => {
    if (!connected) { setModal("connection"); return; }
    setPendingProduct(product);
    setProductDraft({
      name: product.name,
      code: product.code,
      url: product.url,
      platforms: product.platform.split(" · ").filter(Boolean).join(", "),
      distributionStrategy: product.distributionStrategy,
    });
    setModalError("");
    setModalNotice("");
    setModal("edit-product");
  };

  const openCreatePolicy = () => {
    if (!connected) { setModal("connection"); return; }
    setPolicyDraft({ name: "", productId: connectedProducts[0]?.id ?? "", durationMode: "unlimited", durationDays: "30", maxMachines: "", maxUses: "", floating: false, strict: false, requireHeartbeat: false, requireCheckIn: false, checkInInterval: "day", checkInIntervalCount: "1", authenticationStrategy: "LICENSE", expirationBasis: "FROM_CREATION", scheme: "" });
    setModalError("");
    setModal("policy");
  };

  const openCreateToken = () => {
    if (!connected || !connectedProducts.length) { setModal("connection"); return; }
    setTokenProductId((current) => current || connectedProducts[0].id);
    setTokenDraft({ name: "", permissions: ["license.validate", "machine.create"] });
    setTokenExpiry("");
    setModalError("");
    setModal("api-token");
  };

  const openLicenseEditor = (license: PanelLicense) => {
    if (!connected) {
      setModal("connection");
      return;
    }
    setPendingLicense(license);
    setLicenseDraft(null);
    setModalError("");
    setModalNotice("");
    setModal("edit-license");
  };

  const submitLicenseEdits = async () => {
    if (!pendingLicense || !licenseDraft) return;
    setModalError("");
    setModalNotice("");
    try {
      const readLimit = (value: string, label: string, max: number) => {
        if (!value.trim()) return null;
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number < 0 || number > max) {
          throw new Error(`${label}: usa un entero válido o deja el campo vacío para heredar el límite de la policy.`);
        }
        return number;
      };
      let expiry: string | null = null;
      if (licenseDraft.expiry.trim()) {
        const parsed = new Date(`${licenseDraft.expiry.trim()}T23:59:59.999Z`);
        if (!Number.isFinite(parsed.getTime())) throw new Error("La fecha de vencimiento debe tener formato AAAA-MM-DD.");
        expiry = parsed.toISOString();
      }
      let metadata: Record<string, unknown>;
      try {
        const parsed = JSON.parse(licenseDraft.metadata || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        metadata = parsed as Record<string, unknown>;
      } catch {
        throw new Error("Los metadatos deben ser un objeto JSON válido, por ejemplo {\"equipo\":\"norte\"}.");
      }
      const permissions = [...new Set(licenseDraft.permissions.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
      await updateLicense.mutateAsync({
        id: pendingLicense.id,
        name: licenseDraft.name.trim(),
        expiry,
        protected: licenseDraft.protected,
        maxMachines: readLimit(licenseDraft.maxMachines, "Máquinas", 2_147_483_647),
        maxProcesses: readLimit(licenseDraft.maxProcesses, "Procesos", 2_147_483_647),
        maxUsers: readLimit(licenseDraft.maxUsers, "Usuarios", 2_147_483_647),
        maxCores: readLimit(licenseDraft.maxCores, "Núcleos", 2_147_483_647),
        maxMemory: readLimit(licenseDraft.maxMemory, "Memoria (bytes)", Number.MAX_SAFE_INTEGER),
        maxDisk: readLimit(licenseDraft.maxDisk, "Disco (bytes)", Number.MAX_SAFE_INTEGER),
        maxUses: readLimit(licenseDraft.maxUses, "Usos", 2_147_483_647),
        permissions,
        metadata,
      });
      await Promise.all([licensesQuery.refetch(), licenseDetailsQuery.refetch()]);
      setModalNotice("Los cambios se guardaron en Keygen.");
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible guardar los cambios de la licencia.");
    }
  };

  const confirmChangePolicy = async () => {
    if (!pendingLicense || !policyTargetId) return;
    const chosenPolicy = policiesQuery.data?.find((policy) => policy.id === policyTargetId);
    const targetProduct = chosenPolicy?.relationships?.product?.data?.id;
    if (!chosenPolicy || (licenseDetailsQuery.data?.productId && targetProduct && targetProduct !== licenseDetailsQuery.data.productId)) {
      setModalError("Elige una policy del mismo producto vinculada a esta licencia.");
      return;
    }
    setModalError("");
    setModalNotice("");
    try {
      await changeLicensePolicy.mutateAsync({ id: pendingLicense.id, policyId: policyTargetId });
      await Promise.all([licensesQuery.refetch(), licenseDetailsQuery.refetch()]);
      setModal("edit-license");
      setModalNotice("La policy se actualizó. Keygen puede ajustar el vencimiento según la estrategia de transferencia.");
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Keygen no pudo cambiar la policy.");
    }
  };

  const runLicenseUsageAction = async (action: "increment" | "decrement" | "reset") => {
    if (!pendingLicense) return;
    if (action === "reset") {
      setPendingUsageAction(action);
      setModalError("");
      setModal("confirm-usage");
      return;
    }
    setModalError("");
    setModalNotice("");
    try {
      await setLicenseUsage.mutateAsync({ id: pendingLicense.id, action, amount: 1 });
      await Promise.all([licensesQuery.refetch(), licenseDetailsQuery.refetch()]);
      setModalNotice(action === "increment" ? "Se añadió un uso." : "Se descontó un uso.");
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible actualizar el contador de usos.");
    }
  };

  const confirmResetLicenseUsage = async () => {
    if (!pendingLicense) return;
    setModalError("");
    try {
      await setLicenseUsage.mutateAsync({ id: pendingLicense.id, action: "reset" });
      await Promise.all([licensesQuery.refetch(), licenseDetailsQuery.refetch()]);
      setPendingUsageAction(null);
      setModal("edit-license");
      setModalNotice("El contador de usos quedó en cero; las activaciones de máquinas no cambian.");
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible reiniciar los usos.");
    }
  };

  const submitProduct = async () => {
    setModalError("");
    try {
      const platforms = [...new Set(productPlatforms.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
      const product = await createProduct.mutateAsync({
        name: form.productName.trim(),
        code: form.productCode.trim(),
        url: form.productUrl.trim(),
        platforms,
        distributionStrategy: productStrategy,
      });
      setModal(null);
      await productsQuery.refetch();
      setSection("applications");
      if (!product) return;
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible crear el producto.");
    }
  };

  const persistProductEdits = async () => {
    if (!pendingProduct) { setModalError("No se encontró el producto que vas a editar."); return; }
    setModalError("");
    try {
      const platforms = [...new Set(productDraft.platforms.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
      await updateProduct.mutateAsync({
        id: pendingProduct.id,
        name: productDraft.name.trim(),
        code: productDraft.code.trim(),
        url: productDraft.url.trim(),
        platforms,
        distributionStrategy: productDraft.distributionStrategy,
      });
      setModal(null);
      setPendingProduct(null);
      await Promise.all([productsQuery.refetch(), licensesQuery.refetch()]);
      setSection("applications");
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible actualizar el producto.");
    }
  };

  const submitProductEdits = () => {
    if (!pendingProduct) { setModalError("No se encontró el producto que vas a editar."); return; }
    setModalError("");
    if (productDraft.distributionStrategy !== pendingProduct.distributionStrategy) {
      setModal("confirm-product-strategy");
      return;
    }
    void persistProductEdits();
  };

  const submitLicense = async () => {
    setModalError("");
    try {
      const name = licenseNameMode === "random" ? `License-${randomSuffix()}` : form.licenseName.trim();
      if (!name) throw new Error("Escribe el nombre de la licencia o selecciona nombre aleatorio.");
      let expiry: string | null | undefined;
      if (licenseExpiryMode === "never") expiry = null;
      if (licenseExpiryMode === "custom") {
        const parsed = new Date(licenseExpiry);
        if (!licenseExpiry || !Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new Error("Selecciona una fecha de vencimiento futura.");
        expiry = parsed.toISOString();
      }
      const maxUses = licenseMaxUses.trim() ? Number(licenseMaxUses) : undefined;
      if (maxUses !== undefined && (!Number.isSafeInteger(maxUses) || maxUses < 0)) throw new Error("El límite de usos debe ser un entero no negativo.");
      const maxMachines = Number(form.maxMachines);
      if (!Number.isSafeInteger(maxMachines) || maxMachines < 1 || maxMachines > 2_147_483_647) throw new Error("El límite de máquinas debe ser un entero entre 1 y 2 147 483 647.");
      const created = await createLicense.mutateAsync({
        name,
        policyId: form.policyId,
        maxMachines,
        ...(licenseReference.trim() ? { reference: licenseReference.trim() } : {}),
        ...(maxUses !== undefined ? { maxUses } : {}),
        ...(expiry !== undefined ? { expiry } : {}),
      });
      setResultLicenseName(created.name);
      setResultKey(created.key);
      setModal("result");
      await licensesQuery.refetch();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible emitir la licencia.");
    }
  };

  const submitPolicy = async () => {
    setModalError("");
    try {
      if (!policyDraft.productId) throw new Error("Selecciona el producto al que pertenecerá esta policy.");
      const readPolicyLimit = (value: string, label: string) => {
        if (!value.trim()) return null;
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number < 0 || number > 2_147_483_647) throw new Error(`${label}: indica un entero válido o deja vacío para no fijar límite.`);
        return number;
      };
      const days = policyDraft.durationMode === "custom" ? Number(policyDraft.durationDays) : null;
      if (days !== null && (!Number.isSafeInteger(days) || days < 1 || days > 36_500)) throw new Error("La duración debe ser de 1 a 36 500 días.");
      const checkInIntervalCount = Number(policyDraft.checkInIntervalCount);
      if (policyDraft.requireCheckIn && (!Number.isSafeInteger(checkInIntervalCount) || checkInIntervalCount < 1 || checkInIntervalCount > 365)) throw new Error("El intervalo de check-in debe estar entre 1 y 365.");
      await createPolicy.mutateAsync({
        name: policyDraft.name.trim(),
        productId: policyDraft.productId,
        durationSeconds: days === null ? null : days * 86_400,
        maxMachines: readPolicyLimit(policyDraft.maxMachines, "Máquinas"),
        maxUses: readPolicyLimit(policyDraft.maxUses, "Usos"),
        floating: policyDraft.floating,
        strict: policyDraft.strict,
        requireHeartbeat: policyDraft.requireHeartbeat,
        requireCheckIn: policyDraft.requireCheckIn,
        checkInInterval: policyDraft.checkInInterval,
        checkInIntervalCount,
        authenticationStrategy: policyDraft.authenticationStrategy,
        expirationBasis: policyDraft.expirationBasis,
        scheme: policyDraft.scheme || null,
      });
      await policiesQuery.refetch();
      setModal(null);
      setSection("policies");
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible crear la policy.");
    }
  };

  const submitProductToken = async () => {
    setModalError("");
    try {
      if (!selectedTokenProductId) throw new Error("Selecciona el producto que delimitará esta credencial.");
      if (!tokenDraft.permissions.length) throw new Error("Selecciona al menos un permiso.");
      let expiry: string | undefined;
      if (tokenExpiry) {
        const parsed = new Date(tokenExpiry);
        if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new Error("Selecciona una fecha de expiración futura.");
        expiry = parsed.toISOString();
      }
      const created = await createProductToken.mutateAsync({ productId: selectedTokenProductId, name: tokenDraft.name.trim(), permissions: tokenDraft.permissions as any, ...(expiry ? { expiry } : {}) });
      setTokenSecret(created.secret);
      setTokenSecretName(created.name);
      setModal("token-result");
      await productTokensQuery.refetch();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible emitir la credencial.");
    }
  };

  const confirmRevokeToken = async () => {
    if (!pendingToken) return;
    setModalError("");
    try {
      await revokeToken.mutateAsync({ id: pendingToken.id });
      await productTokensQuery.refetch();
      setPendingToken(null);
      setModal(null);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible revocar el token.");
    }
  };

  const confirmToggleLicense = async () => {
    if (!pendingLicense) return;
    setModalError("");
    try {
      await setSuspended.mutateAsync({ id: pendingLicense.id, suspended: !pendingLicense.suspended });
      setModal(null);
      setPendingLicense(null);
      await licensesQuery.refetch();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible actualizar la licencia.");
    }
  };

  const confirmDeactivateMachine = async () => {
    if (!pendingMachine) return;
    setModalError("");
    try {
      await deactivateMachineMutation.mutateAsync({ id: pendingMachine.id });
      setModal(null);
      setPendingMachine(null);
      await machinesQuery.refetch();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No fue posible desactivar la máquina.");
    }
  };

  const runLogin = async (username: string, key: string) => {
    setLoginIssue("");
    setLoginNotice("");
    try {
      const checked = await validateLoginKey.mutateAsync({ username, key });
      validateLoginKey.reset();
      if (!checked.valid) throw new Error("El usuario o la clave no se pudieron verificar con Keygen.");
      setLoginNotice("Licencia verificada. Abriendo tu panel…");
      await refresh();
    } catch (error) {
      setLoginIssue(error instanceof Error ? error.message : "No fue posible iniciar el acceso. Revisa Keygen y la configuración de sesión.");
      setLoginNotice("");
    } finally {
      validateLoginKey.reset();
    }
  };

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen onLogin={runLogin} busy={validateLoginKey.isPending} error={loginIssue} notice={loginNotice} />;

  const sectionTitle = navigation.find((item) => item.id === section)?.label ?? "Vista general";

  const selectSection = (next: Section) => {
    setSection(next);
    setDrawerOpen(false);
  };

  const sectionView = (() => {
    switch (section) {
      case "applications":
        return <ApplicationsSection products={displayProducts} connected={connected} wide={wide} onCreate={openCreateProduct} onManage={openEditProduct} />;
      case "licenses":
        return <LicensesSection licenses={displayLicenses} connected={connected} wide={wide} onGenerate={openCreateLicense} onEdit={openLicenseEditor} onToggle={(license) => { setPendingLicense(license); setModalError(""); setModal("confirm-license"); }} />;
      case "policies":
        return <PoliciesSection policies={policiesQuery.data ?? []} products={displayProducts} connected={connected} loading={policiesQuery.isLoading} wide={wide} onCreate={openCreatePolicy} />;
      case "tokens":
        return <ApiTokensSection products={displayProducts} productId={selectedTokenProductId} tokens={productTokensQuery.data ?? []} connected={connected} loading={productTokensQuery.isLoading} issue={productTokensQuery.error?.message} onProductChange={setTokenProductId} onCreate={openCreateToken} onRevoke={(token) => { setPendingToken(token); setModalError(""); setModal("confirm-token"); }} />;
      case "machines":
        return <MachinesSection machines={machinesQuery.data ?? []} connected={connected} loading={machinesQuery.isLoading} issue={machinesQuery.error?.message} onDeactivate={(machine) => { setPendingMachine(machine); setModalError(""); setModal("confirm-machine"); }} />;
      case "security":
        return <SecuritySection connected={connected} issue={connectionIssue} />;
      case "activity":
        return <ActivitySection connected={connected} events={auditQuery.data?.events ?? []} loading={auditQuery.isLoading} available={Boolean(auditQuery.data?.available)} message={auditQuery.data?.message} issue={auditQuery.error?.message} onRefresh={() => { void auditQuery.refetch(); }} />;
      case "integration":
        return <IntegrationSection connected={connected} configured={Boolean(statusQuery.data?.configured)} issue={connectionIssue} checking={statusQuery.isFetching} onReconnect={() => { void statusQuery.refetch(); }} />;
      case "settings":
        return <SettingsSection userEmail={user?.email} connected={connected} onLogout={logout} />;
      default:
        return <OverviewSection connected={connected} products={displayProducts} licenses={displayLicenses} wide={wide} onCreateLicense={openCreateLicense} onGoToApps={() => selectSection("applications")} onGoToActivity={() => selectSection("activity")} onGoToIntegration={() => selectSection("integration")} events={(auditQuery.data?.events ?? []) as KeygenAuditEvent[]} activityAvailable={Boolean(auditQuery.data?.available)} activityLoading={auditQuery.isLoading} activityIssue={auditQuery.error?.message} />;
    }
  })();

  return (
    <View style={[styles.shell, { minHeight: "100vh" as any }]}>
      {wide ? <Sidebar section={section} onSelect={selectSection} userName={user?.name} userEmail={user?.email} connected={connected} /> : null}
      <View style={styles.appMain}>
        <View style={[styles.topbar, { paddingHorizontal: compact ? 14 : wide ? 22 : 16, minHeight: compact ? 62 : 66 }]}>
          {!wide ? (
            <Pressable accessibilityRole="button" onPress={() => setDrawerOpen(true)} style={styles.menuButton}>
              <Ionicons name="menu-outline" size={21} color={palette.text} />
            </Pressable>
          ) : null}
          <View style={styles.topbarTitleWrap}>
            <Text style={styles.breadcrumb}>{wide ? "ALKAPONEDOLLAR  /  " : ""}{sectionTitle.toUpperCase()}</Text>
            <Text style={styles.topbarSub}>{new Date().toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" })}</Text>
          </View>
          <View style={styles.topbarRight}>
            <Pressable onPress={() => selectSection("integration")} style={styles.connectionTop}>
              <View style={[styles.connectionDot, { backgroundColor: connected ? palette.accent : palette.amber }]} />
              <Text style={styles.connectionTopText}>{connected ? "Keygen conectado" : "Keygen sin conectar"}</Text>
            </Pressable>
            {!drawerOpen ? <><View style={styles.topbarDivider} /><View style={styles.accountAvatar}><Image source={alkaponeAvatar} style={styles.avatarImage} /></View>{!compact ? <View><Text style={styles.accountName}>{user?.name || "Mi cuenta"}</Text><Text style={styles.accountEmail}>{user?.email || "Sesión protegida"}</Text></View> : null}</> : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={[styles.contentScroll, { paddingHorizontal: compact ? 14 : wide ? 28 : 20, paddingTop: compact ? 16 : 24, paddingBottom: compact ? 22 : 28 }]}>
          <View style={[styles.contentInner, { maxWidth: wide ? 1480 : 1000 }]}>{sectionView}</View>
          <Text style={styles.footerNote}>ALKAPONEDOLLAR · CONSOLE 1.0 · {connected ? "KEYGEN API" : "MODO DE VISTA PREVIA"}</Text>
        </ScrollView>
      </View>
      {drawerOpen && !wide ? <MobileDrawer section={section} onSelect={selectSection} onClose={() => setDrawerOpen(false)} userName={user?.name} userEmail={user?.email} connected={connected} /> : null}
      {modal ? (
        <ModalLayer onClose={closeModal} wide={modal === "edit-license" || modal === "edit-product" || modal === "license" || modal === "policy" || modal === "api-token"}>
          {modal === "connection" ? (
            <ModalContent title="Conecta Keygen" subtitle="Para hacer cambios reales, configura las credenciales protegidas del servidor." onClose={closeModal}>
              <View style={styles.connectModalNotice}><Ionicons name="lock-closed-outline" size={20} color={palette.accent} /><Text style={styles.connectModalText}>El token de Keygen no se introduce aquí ni se guarda en el navegador. Se configura como secreto del servidor y se verifica antes de habilitar operaciones.</Text></View>
              {connectionIssue ? <Text style={styles.modalIssue}>{connectionIssue}</Text> : null}
              <ActionButton label="Ver estado de conexión" icon="settings-outline" onPress={() => { closeModal(); selectSection("integration"); }} />
            </ModalContent>
          ) : null}
          {modal === "product" ? (
            <ModalContent title="Nueva aplicación" subtitle="Crear un producto en la cuenta Keygen conectada." onClose={closeModal}>
              <FormField label="Nombre" value={form.productName} placeholder="Ej. Astra CLI" onChange={(value) => setForm((prev) => ({ ...prev, productName: value }))} />
              <FormField label="Código único" value={form.productCode} placeholder="astra-cli" onChange={(value) => setForm((prev) => ({ ...prev, productCode: value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} helper="Usa letras minúsculas, números y guiones." />
              <FormField label="URL (opcional)" value={form.productUrl} placeholder="https://tu-app.com" onChange={(value) => setForm((prev) => ({ ...prev, productUrl: value }))} />
              <FormField label="Plataformas (separadas por coma)" value={productPlatforms} placeholder="Windows, macOS, Linux" onChange={setProductPlatforms} helper="Keygen guardará las plataformas admitidas para este producto." />
              <ChoiceGroup label="DISTRIBUCIÓN" value={productStrategy} options={[{ value: "LICENSED", label: "Con licencia" }, { value: "OPEN", label: "Abierta" }, { value: "CLOSED", label: "Privada" }]} onChange={(value) => setProductStrategy(value as typeof productStrategy)} />
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Cancelar" subtle onPress={closeModal} /><ActionButton label={createProduct.isPending ? "Creando…" : "Crear producto"} icon="add" onPress={submitProduct} disabled={createProduct.isPending || !form.productName.trim() || form.productCode.trim().length < 2} /></View>
            </ModalContent>
          ) : null}
          {modal === "edit-product" && pendingProduct ? (
            <ModalContent title={`Editar ${pendingProduct.name}`} subtitle="Actualiza los datos del producto en Keygen. Un cambio de estrategia requerirá confirmación." wide onClose={closeModal}>
              <FormField label="Nombre" value={productDraft.name} placeholder="Ej. Astra CLI" onChange={(value) => setProductDraft((draft) => ({ ...draft, name: value }))} />
              <FormField label="Código único" value={productDraft.code} placeholder="astra-cli" onChange={(value) => setProductDraft((draft) => ({ ...draft, code: value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} helper="Letras minúsculas, números y guiones; Keygen validará la unicidad." />
              <FormField label="URL (opcional)" value={productDraft.url} placeholder="https://tu-app.com" onChange={(value) => setProductDraft((draft) => ({ ...draft, url: value }))} />
              <FormField label="Plataformas (separadas por coma)" value={productDraft.platforms} placeholder="Windows, macOS, Linux" onChange={(value) => setProductDraft((draft) => ({ ...draft, platforms: value }))} helper="Separa por coma o por salto de línea." />
              <ChoiceGroup label="DISTRIBUCIÓN" value={productDraft.distributionStrategy} options={[{ value: "LICENSED", label: "Con licencia" }, { value: "OPEN", label: "Abierta" }, { value: "CLOSED", label: "Privada" }]} onChange={(value) => setProductDraft((draft) => ({ ...draft, distributionStrategy: value as PanelProduct["distributionStrategy"] }))} />
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Cancelar" subtle onPress={closeModal} /><ActionButton label={updateProduct.isPending ? "Guardando…" : "Guardar cambios"} icon="save-outline" onPress={submitProductEdits} disabled={updateProduct.isPending || !productDraft.name.trim() || productDraft.code.trim().length < 2} /></View>
            </ModalContent>
          ) : null}
          {modal === "confirm-product-strategy" && pendingProduct ? (
            <ModalContent title="Confirmar estrategia" subtitle="Se actualizará la estrategia de distribución remota en Keygen." onClose={closeModal}>
              <View style={styles.connectModalNotice}><Ionicons name="warning-outline" size={20} color={palette.text} /><Text style={styles.connectModalText}>Revisa el cambio antes de aplicarlo. La actualización reemplaza la estrategia actual del producto en Keygen; no se ejecutará hasta que confirmes.</Text></View>
              <View style={styles.editReadonlyCard}>
                <Text style={styles.fieldLabel}>PRODUCTO</Text><Text style={styles.policyTitle}>{pendingProduct.name}</Text>
                <Text style={styles.fieldLabel}>CAMBIO</Text>
                <Text style={styles.cardMuted}>{pendingProduct.distributionStrategy === "OPEN" ? "Abierta" : pendingProduct.distributionStrategy === "CLOSED" ? "Privada" : "Con licencia"}  →  {productDraft.distributionStrategy === "OPEN" ? "Abierta" : productDraft.distributionStrategy === "CLOSED" ? "Privada" : "Con licencia"}</Text>
              </View>
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Revisar" subtle onPress={() => { setModalError(""); setModal("edit-product"); }} /><ActionButton label={updateProduct.isPending ? "Aplicando…" : "Confirmar y guardar"} icon="checkmark-circle-outline" onPress={() => { void persistProductEdits(); }} disabled={updateProduct.isPending} /></View>
            </ModalContent>
          ) : null}
          {modal === "license" ? (
            <ModalContent title="Generar licencia" subtitle="Define la clave bajo una policy real de Keygen. La clave criptográfica la crea Keygen; es distinta del nombre visible." wide onClose={closeModal}>
              <ChoiceGroup label="NOMBRE DE LA LICENCIA" value={licenseNameMode} options={[{ value: "random", label: "Aleatorio" }, { value: "custom", label: "Personalizado" }]} onChange={(value) => setLicenseNameMode(value as typeof licenseNameMode)} />
              {licenseNameMode === "custom" ? <FormField label="USERNAME / NOMBRE DE LA LICENCIA" value={form.licenseName} placeholder="Ej. A" onChange={(value) => setForm((prev) => ({ ...prev, licenseName: value }))} helper="Este valor será el username que debes escribir en la APK junto con la key generada. La validación exige que coincida exactamente." /> : <View style={styles.connectModalNotice}><Ionicons name="sparkles-outline" size={18} color={palette.text} /><Text style={styles.connectModalText}>Se asignará un username aleatorio legible. La clave de licencia la genera y firma Keygen según la policy; usa el username mostrado en el resultado para entrar en la APK.</Text></View>}
              <Text style={styles.fieldLabel}>POLICY DE KEYGEN</Text>
              {policiesQuery.isLoading ? <View style={styles.inlineLoading}><ActivityIndicator color={palette.accent} /><Text style={styles.cardMuted}>Cargando policies…</Text></View> : null}
              <ChoiceGroup label="APK / APLICACIÓN DESTINO" value={selectedLicenseProductId} options={displayProducts.filter((product) => product.id).map((product) => ({ value: product.id, label: product.name }))} onChange={(value) => { setLicenseProductId(value); setForm((prev) => ({ ...prev, policyId: "" })); }} />
              <Text style={styles.cardMuted}>La licencia solo podrá activar la aplicación seleccionada y sus máquinas quedarán registradas en el monitoreo de este producto.</Text>
              {(policiesQuery.data ?? []).filter((policy) => policy.relationships?.product?.data?.id === selectedLicenseProductId).map((policy) => {
                const policyName = String(policy.attributes?.name ?? "Policy sin nombre");
                const productId = policy.relationships?.product?.data?.id;
                const productName = displayProducts.find((item) => item.id === productId)?.name ?? "Producto Keygen";
                const selected = form.policyId === policy.id;
                return <Pressable key={policy.id} onPress={() => setForm((prev) => ({ ...prev, policyId: policy.id }))} style={[styles.policyChoice, selected && styles.policySelected]}><View style={[styles.radio, selected && styles.radioSelected]} /> <View style={{ flex: 1 }}><Text style={styles.policyTitle}>{policyName}</Text><Text style={styles.policySubtitle}>{productName}</Text></View><Ionicons name="chevron-forward" size={15} color={palette.faint} /></Pressable>;
              })}
              {!policiesQuery.isLoading && !(policiesQuery.data ?? []).some((policy) => policy.relationships?.product?.data?.id === selectedLicenseProductId) ? <View style={styles.emptyPolicy}><Ionicons name="alert-circle-outline" size={18} color={palette.amber} /><Text style={styles.cardMuted}>No hay policies para esta aplicación. Crea una policy para el producto seleccionado y vuelve a abrir este formulario.</Text></View> : null}
              <ChoiceGroup label="VENCIMIENTO" value={licenseExpiryMode} options={[{ value: "policy", label: "Heredar policy" }, { value: "never", label: "Sin vencimiento" }, { value: "custom", label: "Fecha propia" }]} onChange={(value) => setLicenseExpiryMode(value as typeof licenseExpiryMode)} />
              {licenseExpiryMode === "custom" ? <FormField type="datetime-local" label="Fecha y hora de expiración" value={licenseExpiry} placeholder="Selecciona fecha y hora" onChange={setLicenseExpiry} helper="Se enviará a Keygen como timestamp ISO 8601." /> : null}
              <FormField label="Máquinas permitidas" value={form.maxMachines} placeholder="1" keyboardType="numeric" onChange={(value) => setForm((prev) => ({ ...prev, maxMachines: value.replace(/[^0-9]/g, "") }))} helper="Debe ser un número entero mayor que cero." />
              <FormField label="Usos máximos (opcional)" value={licenseMaxUses} placeholder="Heredar policy" keyboardType="numeric" onChange={(value) => setLicenseMaxUses(value.replace(/[^0-9]/g, ""))} helper="Vacío = sin override; 0 bloquea usos." />
              <FormField label="Referencia interna (opcional)" value={licenseReference} placeholder="Ej. pedido-1042" onChange={(value) => setLicenseReference(value.slice(0, 500))} helper="Se guarda como metadata de la licencia; no se usa como nombre ni como clave." />
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Cancelar" subtle onPress={closeModal} /><ActionButton label={createLicense.isPending ? "Emitiendo…" : "Emitir clave"} icon="key" onPress={submitLicense} disabled={createLicense.isPending || (licenseNameMode === "custom" && !form.licenseName.trim()) || !form.policyId} /></View>
            </ModalContent>
          ) : null}
          {modal === "policy" ? (
            <ModalContent title="Crear policy" subtitle="Define las reglas que Keygen aplicará a las nuevas licencias." wide onClose={closeModal}>
              <FormField label="Nombre de la policy" value={policyDraft.name} placeholder="Ej. Pro · 3 dispositivos" onChange={(value) => setPolicyDraft((draft) => ({ ...draft, name: value }))} />
              <ChoiceGroup label="PRODUCTO" value={policyDraft.productId} options={displayProducts.map((product) => ({ value: product.id, label: product.name }))} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, productId: value }))} />
              <ChoiceGroup label="DURACIÓN DE LA LICENCIA" value={policyDraft.durationMode} options={[{ value: "unlimited", label: "Sin límite" }, { value: "custom", label: "Duración fija" }]} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, durationMode: value as typeof draft.durationMode }))} />
              {policyDraft.durationMode === "custom" ? <FormField label="Duración en días" value={policyDraft.durationDays} placeholder="30" keyboardType="numeric" onChange={(value) => setPolicyDraft((draft) => ({ ...draft, durationDays: value.replace(/[^0-9]/g, "") }))} helper="Máximo 36 500 días. Keygen recibirá la duración en segundos." /> : null}
              <View style={styles.editorFieldsGrid}>
                <FormField style={styles.editorField} label="Máquinas máximas" value={policyDraft.maxMachines} placeholder={policyDraft.floating ? "Sin límite" : "1"} keyboardType="numeric" onChange={(value) => setPolicyDraft((draft) => ({ ...draft, maxMachines: value.replace(/[^0-9]/g, "") }))} helper="Las policies no flotantes usan 1." />
                <FormField style={styles.editorField} label="Usos máximos" value={policyDraft.maxUses} placeholder="Sin límite" keyboardType="numeric" onChange={(value) => setPolicyDraft((draft) => ({ ...draft, maxUses: value.replace(/[^0-9]/g, "") }))} helper="Deja vacío para heredar ilimitado." />
              </View>
              <ChoiceGroup label="ESTRATEGIA DE AUTENTICACIÓN" value={policyDraft.authenticationStrategy} options={[{ value: "LICENSE", label: "License key" }, { value: "TOKEN", label: "Token" }, { value: "MIXED", label: "Mixta" }, { value: "NONE", label: "Ninguna" }]} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, authenticationStrategy: value as typeof draft.authenticationStrategy }))} />
              <ChoiceGroup label="CUÁNDO EMPIEZA EL VENCIMIENTO" value={policyDraft.expirationBasis} options={[{ value: "FROM_CREATION", label: "Al crear" }, { value: "FROM_FIRST_VALIDATION", label: "Primera validación" }, { value: "FROM_FIRST_ACTIVATION", label: "Primera activación" }]} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, expirationBasis: value as typeof draft.expirationBasis }))} />
              <ChoiceGroup label="ESQUEMA DE FIRMA" value={policyDraft.scheme} options={[{ value: "", label: "Predeterminado" }, { value: "ED25519_SIGN", label: "ED25519" }]} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, scheme: value as typeof draft.scheme }))} />
              <View style={styles.toggleStack}>
                <ToggleField label="Policy flotante" description="Permite su uso en varias máquinas; el límite depende de strict." value={policyDraft.floating} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, floating: value, maxMachines: value ? draft.maxMachines : "1" }))} />
                <ToggleField label="Validación estricta" description="Aplica límites con enforcement estricto y exige al menos una máquina." value={policyDraft.strict} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, strict: value }))} />
                <ToggleField label="Exigir heartbeat" description="La máquina debe mantener el heartbeat configurado por Keygen." value={policyDraft.requireHeartbeat} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, requireHeartbeat: value }))} />
                <ToggleField label="Exigir check-in" description="La policy requerirá check-in periódico según la configuración de Keygen." value={policyDraft.requireCheckIn} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, requireCheckIn: value }))} />
                {policyDraft.requireCheckIn ? <View style={styles.editorFieldsGrid}><ChoiceGroup label="INTERVALO DE CHECK-IN" value={policyDraft.checkInInterval} options={[{ value: "day", label: "Días" }, { value: "week", label: "Semanas" }, { value: "month", label: "Meses" }, { value: "year", label: "Años" }]} onChange={(value) => setPolicyDraft((draft) => ({ ...draft, checkInInterval: value as typeof draft.checkInInterval }))} /><FormField style={styles.editorField} label="Cada cuántos intervalos" value={policyDraft.checkInIntervalCount} placeholder="1" keyboardType="numeric" onChange={(value) => setPolicyDraft((draft) => ({ ...draft, checkInIntervalCount: value.replace(/[^0-9]/g, "") }))} helper="De 1 a 365." /></View> : null}
              </View>
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Cancelar" subtle onPress={closeModal} /><ActionButton label={createPolicy.isPending ? "Creando…" : "Crear policy"} icon="options" onPress={submitPolicy} disabled={createPolicy.isPending || !policyDraft.name.trim() || !policyDraft.productId} /></View>
            </ModalContent>
          ) : null}
          {modal === "api-token" ? (
            <ModalContent title="Nueva API key" subtitle="Emitir un token de producto Keygen con permisos mínimos y alcance por producto." onClose={closeModal}>
              <Text style={styles.fieldLabel}>PRODUCTO</Text>
              <View style={styles.choiceRow}>{displayProducts.map((product) => <Pressable key={product.id} accessibilityRole="button" accessibilityState={{ selected: product.id === selectedTokenProductId }} onPress={() => setTokenProductId(product.id)} style={[styles.choiceChip, product.id === selectedTokenProductId && styles.choiceChipActive]}><Text style={[styles.choiceChipText, product.id === selectedTokenProductId && styles.choiceChipTextActive]}>{product.name}</Text></Pressable>)}</View>
              <FormField label="Nombre para identificarla" value={tokenDraft.name} placeholder="Ej. Backend de validación" onChange={(value) => setTokenDraft((draft) => ({ ...draft, name: value }))} />
              <FormField type="datetime-local" label="Expiración (opcional)" value={tokenExpiry} placeholder="Sin expiración" onChange={setTokenExpiry} helper="Una fecha fija limita el tiempo de validez del token." />
              <Text style={styles.fieldLabel}>PERMISOS · SELECCIONA SOLO LOS NECESARIOS</Text>
              <View style={styles.toggleStack}>{["license.validate", "license.read", "license.create", "machine.create", "machine.read", "machine.delete", "machine.check-out"].map((permission) => <ToggleField key={permission} label={permission} description="Permiso de producto limitado por Keygen." value={tokenDraft.permissions.includes(permission)} onChange={(checked) => setTokenDraft((draft) => ({ ...draft, permissions: checked ? [...new Set([...draft.permissions, permission])] : draft.permissions.filter((item) => item !== permission) }))} />)}</View>
              <View style={styles.connectModalNotice}><Ionicons name="warning-outline" size={18} color={palette.text} /><Text style={styles.connectModalText}>Keygen muestra el secreto solo una vez. No lo incorpores a código cliente, web pública ni una app distribuida; guárdalo en el servidor de tu aplicación.</Text></View>
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Cancelar" subtle onPress={closeModal} /><ActionButton label={createProductToken.isPending ? "Generando…" : "Generar API key"} icon="key" onPress={submitProductToken} disabled={createProductToken.isPending || !selectedTokenProductId || !tokenDraft.name.trim() || !tokenDraft.permissions.length} /></View>
            </ModalContent>
          ) : null}
          {modal === "token-result" ? (
            <ModalContent title="Guarda tu API key" subtitle="Keygen no volverá a mostrar este secreto después de cerrar esta ventana." onClose={closeModal}>
              <View style={styles.tokenSecretCard}><Text style={styles.fieldLabel}>{tokenSecretName.toUpperCase()}</Text><Text selectable style={styles.tokenSecretValue}>{tokenSecret || "No se recibió el secreto de Keygen."}</Text></View>
              <View style={styles.connectModalNotice}><Ionicons name="shield-checkmark-outline" size={18} color={palette.text} /><Text style={styles.connectModalText}>Cópiala ahora y almacénala en el backend que conectará tu aplicación. El listado del panel nunca recupera ni expone este valor.</Text></View>
              <View style={styles.modalActions}><ActionButton label="Copiar API key" icon="copy-outline" onPress={() => { void copyToClipboard(tokenSecret); }} disabled={!tokenSecret} /><ActionButton label="Listo" subtle onPress={closeModal} /></View>
            </ModalContent>
          ) : null}
          {modal === "confirm-token" ? (
            <ModalContent title="Revocar API key" subtitle="La revocación es inmediata e irreversible." onClose={closeModal}>
              <View style={styles.connectModalNotice}><Ionicons name="warning-outline" size={20} color={palette.text} /><Text style={styles.connectModalText}>El token {pendingToken?.name ? `“${pendingToken.name}”` : "seleccionado"} dejará de funcionar para todas las integraciones que lo usan. Las aplicaciones deberán recibir otra credencial.</Text></View>
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Cancelar" subtle onPress={closeModal} /><ActionButton label={revokeToken.isPending ? "Revocando…" : "Revocar token"} icon="trash-outline" onPress={confirmRevokeToken} disabled={revokeToken.isPending || !pendingToken} /></View>
            </ModalContent>
          ) : null}
          {modal === "edit-license" ? (
            <ModalContent title={licenseDetailsQuery.data?.name ? `Editar ${licenseDetailsQuery.data.name}` : "Editar licencia"} subtitle="Ajusta límites, acceso y metadatos directamente en Keygen." wide onClose={closeModal}>
              {licenseDetailsQuery.isLoading || !licenseDetailsQuery.data || !licenseDraft ? <View style={styles.inlineLoading}><ActivityIndicator color={palette.accent} /><Text style={styles.cardMuted}>Cargando detalles protegidos…</Text></View> : (
                <>
                  <View style={styles.editReadonlyCard}>
                    <View style={styles.editReadonlyTop}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>KEY ENMASCARADA · SOLO LECTURA</Text><Text style={styles.resultKey}>{licenseDetailsQuery.data.maskedKey}</Text></View><StatusBadge label={licenseDetailsQuery.data.status} tone={licenseDetailsQuery.data.suspended ? "bad" : "good"} /></View>
                    <Text style={styles.cardMuted}>{licenseDetailsQuery.data.productName} · Policy: {licenseDetailsQuery.data.policyName || "sin nombre"} · ID: {licenseDetailsQuery.data.id}</Text>
                    <Text style={styles.cardMuted}>Keygen no ofrece editar el valor de una key existente. La clave completa no se envía al navegador.</Text>
                  </View>
                  <View style={styles.editorFieldsGrid}>
                    <FormField style={styles.editorFieldFull} label="Nombre / cliente" value={licenseDraft.name} placeholder="Ej. Pro · Acme Studio" onChange={(value) => setLicenseDraft((current) => current ? { ...current, name: value } : current)} />
                    <FormField style={styles.editorField} label="Vencimiento (AAAA-MM-DD)" value={licenseDraft.expiry} placeholder="Vacío = sin vencimiento" onChange={(value) => setLicenseDraft((current) => current ? { ...current, expiry: value } : current)} helper="Vacío elimina la fecha de vencimiento." />
                    <FormField label="Máquinas" value={licenseDraft.maxMachines} placeholder="Heredar policy" keyboardType="numeric" onChange={(value) => setLicenseDraft((current) => current ? { ...current, maxMachines: value.replace(/[^0-9]/g, "") } : current)} />
                    <FormField label="Procesos" value={licenseDraft.maxProcesses} placeholder="Heredar policy" keyboardType="numeric" onChange={(value) => setLicenseDraft((current) => current ? { ...current, maxProcesses: value.replace(/[^0-9]/g, "") } : current)} />
                    <FormField label="Usuarios" value={licenseDraft.maxUsers} placeholder="Heredar policy" keyboardType="numeric" onChange={(value) => setLicenseDraft((current) => current ? { ...current, maxUsers: value.replace(/[^0-9]/g, "") } : current)} />
                    <FormField label="Núcleos CPU" value={licenseDraft.maxCores} placeholder="Heredar policy" keyboardType="numeric" onChange={(value) => setLicenseDraft((current) => current ? { ...current, maxCores: value.replace(/[^0-9]/g, "") } : current)} />
                    <FormField label="Memoria máxima (bytes)" value={licenseDraft.maxMemory} placeholder="Heredar policy" keyboardType="numeric" onChange={(value) => setLicenseDraft((current) => current ? { ...current, maxMemory: value.replace(/[^0-9]/g, "") } : current)} />
                    <FormField label="Disco máximo (bytes)" value={licenseDraft.maxDisk} placeholder="Heredar policy" keyboardType="numeric" onChange={(value) => setLicenseDraft((current) => current ? { ...current, maxDisk: value.replace(/[^0-9]/g, "") } : current)} />
                    <FormField label="Usos máximos" value={licenseDraft.maxUses} placeholder="Heredar policy" keyboardType="numeric" onChange={(value) => setLicenseDraft((current) => current ? { ...current, maxUses: value.replace(/[^0-9]/g, "") } : current)} />
                  </View>
                  <Pressable accessibilityRole="button" accessibilityState={{ checked: licenseDraft.protected }} onPress={() => setLicenseDraft((current) => current ? { ...current, protected: !current.protected } : current)} style={styles.editorToggle}>
                    <View style={[styles.editorCheck, licenseDraft.protected && styles.editorCheckActive]}>{licenseDraft.protected ? <Ionicons name="checkmark" size={13} color={palette.bg} /> : null}</View>
                    <View style={{ flex: 1 }}><Text style={styles.policyTitle}>Licencia protegida</Text><Text style={styles.policySubtitle}>Impide que el usuario administre por sí mismo sus máquinas.</Text></View>
                  </Pressable>
                  <FormField multiline style={styles.editorFieldFull} label="Permisos · uno por línea" value={licenseDraft.permissions} placeholder="license.read\nlicense.validate" onChange={(value) => setLicenseDraft((current) => current ? { ...current, permissions: value } : current)} helper="Permisos de la licencia definidos por Keygen." />
                  <FormField multiline style={styles.editorFieldFull} label="Metadata JSON" value={licenseDraft.metadata} placeholder="{}" onChange={(value) => setLicenseDraft((current) => current ? { ...current, metadata: value } : current)} helper="Objeto JSON editable. No guardes secretos aquí." />
                  <View style={styles.editReadonlyCard}>
                    <View style={styles.editorSectionHeader}><View><Text style={styles.fieldLabel}>CONTADOR DE USOS</Text><Text style={styles.policyTitle}>{licenseDetailsQuery.data.uses} / {licenseDetailsQuery.data.maxUses ?? "sin límite"}</Text></View><View style={styles.usageActions}>
                      <Pressable accessibilityRole="button" onPress={() => { void runLicenseUsageAction("decrement"); }} disabled={setLicenseUsage.isPending || licenseDetailsQuery.data.uses <= 0} style={styles.usageButton}><Ionicons name="remove" size={15} color={palette.text} /></Pressable>
                      <Pressable accessibilityRole="button" onPress={() => { void runLicenseUsageAction("increment"); }} disabled={setLicenseUsage.isPending} style={styles.usageButton}><Ionicons name="add" size={15} color={palette.text} /></Pressable>
                      <ActionButton label="Reiniciar" subtle onPress={() => { void runLicenseUsageAction("reset"); }} disabled={setLicenseUsage.isPending} />
                    </View></View>
                    <Text style={styles.cardMuted}>Usos no equivale a activaciones de máquinas; Keygen recomienda controlar las activaciones en el módulo de equipos.</Text>
                  </View>
                  <View style={styles.editReadonlyCard}>
                    <View style={styles.editorSectionHeader}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>POLICY VINCULADA</Text><Text style={styles.policyTitle}>{licenseDetailsQuery.data.policyName || "Policy sin nombre"}</Text></View><ActionButton label="Cambiar policy" icon="options-outline" subtle onPress={() => { setPolicyTargetId(licenseDetailsQuery.data?.policyId ?? ""); setModalError(""); setModalNotice(""); setModal("change-policy"); }} /></View>
                    <Text style={styles.cardMuted}>El cambio afecta validaciones futuras y puede ajustar el vencimiento.</Text>
                  </View>
                  {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
                  {modalNotice ? <Text style={styles.modalNotice}>{modalNotice}</Text> : null}
                  <View style={styles.modalActions}><ActionButton label="Cerrar" subtle onPress={closeModal} /><ActionButton label={updateLicense.isPending ? "Guardando…" : "Guardar cambios"} icon="save-outline" onPress={() => { void submitLicenseEdits(); }} disabled={updateLicense.isPending || !licenseDraft.name.trim()} /></View>
                </>
              )}
            </ModalContent>
          ) : null}
          {modal === "change-policy" && pendingLicense ? (
            <ModalContent title="Cambiar policy" subtitle={`${pendingLicense.name} · el cambio se aplicará en Keygen.`} onClose={() => setModal("edit-license")}>
              <View style={styles.connectModalNotice}><Ionicons name="warning-outline" size={20} color={palette.muted} /><Text style={styles.connectModalText}>El cambio surte efecto para futuras validaciones y puede modificar el vencimiento. Keygen rechaza combinaciones incompatibles de cifrado, pool, fingerprints o esquema criptográfico.</Text></View>
              {policiesQuery.isLoading ? <View style={styles.inlineLoading}><ActivityIndicator color={palette.accent} /><Text style={styles.cardMuted}>Cargando policies…</Text></View> : null}
              {(policiesQuery.data ?? []).filter((policy) => !licenseDetailsQuery.data?.productId || policy.relationships?.product?.data?.id === licenseDetailsQuery.data.productId).map((policy) => {
                const selected = policyTargetId === policy.id;
                return <Pressable key={policy.id} onPress={() => setPolicyTargetId(policy.id)} style={[styles.policyChoice, selected && styles.policySelected]}><View style={[styles.radio, selected && styles.radioSelected]} /><View style={{ flex: 1 }}><Text style={styles.policyTitle}>{String(policy.attributes?.name ?? "Policy sin nombre")}</Text><Text style={styles.policySubtitle}>{policy.id}</Text></View>{policy.id === licenseDetailsQuery.data?.policyId ? <Text style={styles.policySubtitle}>ACTUAL</Text> : null}</Pressable>;
              })}
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              {modalNotice ? <Text style={styles.modalNotice}>{modalNotice}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Volver" subtle onPress={() => { setModalError(""); setModal("edit-license"); }} /><ActionButton label={changeLicensePolicy.isPending ? "Aplicando…" : "Confirmar cambio"} icon="swap-horizontal" onPress={() => { void confirmChangePolicy(); }} disabled={changeLicensePolicy.isPending || !policyTargetId || policyTargetId === licenseDetailsQuery.data?.policyId} /></View>
            </ModalContent>
          ) : null}
          {modal === "result" ? (
            <ModalContent title="Licencia emitida" subtitle="Guarda el username y la key; ambos se necesitan para entrar en la APK." onClose={closeModal}>
              <View style={styles.resultCard}><Ionicons name="checkmark-circle" size={23} color={palette.accent} /><Text style={styles.resultLabel}>USERNAME</Text><Text selectable style={styles.resultKey}>{resultLicenseName || "No se recibió el username."}</Text><Text style={[styles.resultLabel, { marginTop: 14 }]}>CLAVE GENERADA</Text><Text selectable style={styles.resultKey}>{resultKey || "Keygen creó la licencia, pero no devolvió la clave en la respuesta."}</Text></View>
              <Text style={styles.cardMuted}>La clave solo se muestra aquí en esta confirmación. No se almacena en el navegador.</Text>
              <View style={styles.modalActions}><ActionButton label="Cerrar" subtle onPress={closeModal} />{resultKey ? <ActionButton label="Copiar clave" icon="copy-outline" onPress={() => copyToClipboard(resultKey)} /> : null}</View>
            </ModalContent>
          ) : null}
          {modal === "confirm-license" && pendingLicense ? (
            <ModalContent title={pendingLicense.suspended ? "Reactivar licencia" : "Suspender licencia"} subtitle={`${pendingLicense.name} · ${pendingLicense.product}`} onClose={closeModal}>
              <View style={styles.connectModalNotice}><Ionicons name={pendingLicense.suspended ? "play-circle-outline" : "pause-circle-outline"} size={21} color={pendingLicense.suspended ? palette.accent : palette.amber} /><Text style={styles.connectModalText}>{pendingLicense.suspended ? "La clave volverá a estar disponible para validación." : "La suspensión puede bloquear el acceso asociado a esta clave."} Confirma para actualizar el estado en Keygen.</Text></View>
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Cancelar" subtle onPress={closeModal} /><ActionButton label={setSuspended.isPending ? "Actualizando…" : pendingLicense.suspended ? "Reactivar" : "Suspender"} icon={pendingLicense.suspended ? "play" : "pause"} onPress={confirmToggleLicense} disabled={setSuspended.isPending} /></View>
            </ModalContent>
          ) : null}
          {modal === "confirm-usage" && pendingLicense && pendingUsageAction === "reset" ? (
            <ModalContent title="Reiniciar usos" subtitle={`${pendingLicense.name} · esta acción afecta el contador de usos.`} onClose={() => { setPendingUsageAction(null); setModal("edit-license"); }}>
              <View style={styles.connectModalNotice}><Ionicons name="warning-outline" size={20} color={palette.muted} /><Text style={styles.connectModalText}>Keygen pondrá el contador de usos en cero. Esto no elimina ni cambia las activaciones de máquinas. Confirma solo si realmente quieres reiniciar ese contador.</Text></View>
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Volver" subtle onPress={() => { setPendingUsageAction(null); setModal("edit-license"); }} /><ActionButton label={setLicenseUsage.isPending ? "Reiniciando…" : "Confirmar reinicio"} icon="refresh" onPress={() => { void confirmResetLicenseUsage(); }} disabled={setLicenseUsage.isPending} /></View>
            </ModalContent>
          ) : null}
          {modal === "confirm-machine" && pendingMachine ? (
            <ModalContent title="Desactivar equipo" subtitle={`${pendingMachine.name} · ${pendingMachine.productName}`} onClose={closeModal}>
              <View style={styles.connectModalNotice}><Ionicons name="warning-outline" size={21} color={palette.muted} /><Text style={styles.connectModalText}>Esta acción no se puede deshacer. Keygen eliminará la máquina y los procesos/componentes asociados. Confirma solo si quieres liberar esta activación.</Text></View>
              {modalError ? <Text style={styles.modalIssue}>{modalError}</Text> : null}
              <View style={styles.modalActions}><ActionButton label="Conservar equipo" subtle onPress={closeModal} /><ActionButton label={deactivateMachineMutation.isPending ? "Desactivando…" : "Desactivar definitivamente"} icon="trash-outline" onPress={confirmDeactivateMachine} disabled={deactivateMachineMutation.isPending} /></View>
            </ModalContent>
          ) : null}
        </ModalLayer>
      ) : null}
    </View>
  );
}

function makeProducts(resources: KeygenResource[], licenses: any[]): PanelProduct[] {
  return resources.map((resource, index) => {
    const attrs = resource.attributes ?? {};
    const itemLicenses = licenses.filter((license) => license.productId === resource.id);
    const active = makeLicenses(itemLicenses).filter((license) => license.status === "Activa" || license.status === "Por vencer").length;
    const platforms = Array.isArray(attrs.platforms) ? attrs.platforms.filter((item): item is string => typeof item === "string").join(" · ") : "";
    const distributionStrategy = attrs.distributionStrategy === "OPEN" || attrs.distributionStrategy === "CLOSED" ? attrs.distributionStrategy : "LICENSED";
    return {
      id: resource.id,
      name: String(attrs.name ?? "Producto sin nombre"),
      code: String(attrs.code ?? resource.id.slice(0, 8)),
      url: typeof attrs.url === "string" ? attrs.url : "",
      distributionStrategy,
      platform: platforms,
      licenses: itemLicenses.length,
      active,
      color: productColors[index % productColors.length],
    };
  });
}

function makeLicenses(resources: any[]): PanelLicense[] {
  const now = Date.now();
  return resources.map((resource) => {
    const attrs = resource.attributes ?? {};
    const rawStatus = String(attrs.status ?? "").toUpperCase();
    const suspended = Boolean(attrs.suspended) || rawStatus === "SUSPENDED";
    const expiry = typeof attrs.expiry === "string" ? new Date(attrs.expiry) : null;
    const expired = rawStatus === "EXPIRED" || Boolean(expiry && expiry.getTime() < now);
    const expiring = expiry && !expired && expiry.getTime() - now < 14 * 24 * 60 * 60 * 1000;
    const status = suspended ? "Suspendida" : expired ? "Expirada" : expiring ? "Por vencer" : !rawStatus || rawStatus === "ACTIVE" ? "Activa" : "Inactiva";
    const maskedKey = typeof resource.maskedKey === "string" ? resource.maskedKey : "Clave protegida";
    const expires = expiry ? expiry.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "Sin vencimiento";
    const machineCount = typeof attrs.machineCount === "number" ? attrs.machineCount : 0;
    const maxMachines = typeof attrs.maxMachines === "number" ? attrs.maxMachines : null;
    return {
      id: resource.id,
      name: String(attrs.name ?? `Licencia ${resource.id.slice(0, 6)}`),
      key: maskedKey,
      product: String(resource.productName || "Producto"),
      status,
      expires,
      machines: `${machineCount} / ${maxMachines ?? "∞"}`,
      suspended,
    };
  });
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <View style={[styles.brandMark, small && styles.brandMarkSmall]}>
      <Image source={alkaponeAvatar} style={[styles.brandImage, small && styles.brandImageSmall]} resizeMode="cover" />
    </View>
  );
}

function Sidebar({ section, onSelect, userName, userEmail, connected }: { section: Section; onSelect: (section: Section) => void; userName?: string | null; userEmail?: string | null; connected: boolean }) {
  const [filter, setFilter] = useState("");
  const [favorites, setFavorites] = useState<Section[]>(["overview", "licenses"]);
  const toggleFavorite = (id: Section) => setFavorites((current) => current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id]);
  const visible = navigation.filter((item) => item.label.toLowerCase().includes(filter.toLowerCase()));
  return (
    <View style={styles.sidebar}>
      <View style={styles.iconRail}>
        <View style={styles.railBrand}><BrandMark small /></View>
        <View style={styles.railDivider} />
        {navigation.slice(0, 7).map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => onSelect(item.id)} style={[styles.railButton, section === item.id && styles.railButtonActive]}><Ionicons name={item.icon} size={18} color={section === item.id ? palette.text : palette.faint} /></Pressable>)}
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" onPress={() => onSelect("settings")} style={[styles.railButton, section === "settings" && styles.railButtonActive]}><Ionicons name="settings-outline" size={18} color={section === "settings" ? palette.text : palette.faint} /></Pressable>
        <View style={styles.railAvatar}><Image source={alkaponeAvatar} style={styles.railAvatarImage} /></View>
      </View>
      <View style={styles.sidePanel}>
        <View style={styles.workspaceHeading}><BrandMark small /><View style={{ flex: 1 }}><Text style={styles.workspaceName}>ALKAPONEDOLLAR</Text><Text style={styles.workspaceSub}>CONTROL CENTER</Text></View><Ionicons name="chevron-down" size={15} color={palette.faint} /></View>
        <View style={styles.quickSearch}><Ionicons name="search" size={15} color={palette.faint} /><TextInput value={filter} onChangeText={setFilter} placeholder="Buscar sección" placeholderTextColor={palette.faint} style={styles.quickSearchInput} /><Text style={styles.searchShortcut}>⌘ K</Text></View>
        <ScrollView style={styles.sidebarNavScroll} contentContainerStyle={styles.sidebarNavContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.navGroup}>GESTIÓN</Text>
          {visible.filter((item) => ["overview", "applications", "licenses", "policies", "machines"].includes(item.id)).map((item) => <NavButton key={item.id} item={item} active={section === item.id} favorite={favorites.includes(item.id)} onPress={() => onSelect(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} />)}
          <Text style={[styles.navGroup, styles.navGroupSpaced]}>MONITOREO</Text>
          {visible.filter((item) => ["security", "activity"].includes(item.id)).map((item) => <NavButton key={item.id} item={item} active={section === item.id} favorite={favorites.includes(item.id)} onPress={() => onSelect(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} />)}
          <Text style={[styles.navGroup, styles.navGroupSpaced]}>CONEXIONES</Text>
          {visible.filter((item) => ["tokens", "integration", "settings"].includes(item.id)).map((item) => <NavButton key={item.id} item={item} active={section === item.id} favorite={favorites.includes(item.id)} onPress={() => onSelect(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} />)}
        </ScrollView>
        <Pressable onPress={() => onSelect("integration")} style={styles.sidebarConnection}><View style={[styles.sidebarConnectionDot, { backgroundColor: connected ? palette.accent : palette.faint }]} /><View style={{ flex: 1 }}><Text style={styles.sidebarConnectionTitle}>KEYGEN API</Text><Text style={styles.sidebarConnectionSub}>{connected ? "Cuenta conectada" : "Conexión pendiente"}</Text></View><Ionicons name="chevron-forward" size={14} color={palette.faint} /></Pressable>
        <View style={styles.sidebarUser}><View style={styles.accountAvatar}><Image source={alkaponeAvatar} style={styles.avatarImage} /></View><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.accountName}>{userName || "Mi cuenta"}</Text><Text numberOfLines={1} style={styles.accountEmail}>{userEmail || "Acceso de propietario"}</Text></View><Pressable onPress={() => onSelect("settings")} accessibilityRole="button" accessibilityLabel="Abrir ajustes de cuenta"><Ionicons name="ellipsis-horizontal" size={16} color={palette.muted} /></Pressable></View>
        <Text style={styles.sidebarVersion}>PRIVATE CONSOLE · 1.0.0</Text>
      </View>
    </View>
  );
}

function NavButton({ item, active, favorite, onPress, onToggleFavorite }: { item: (typeof navigation)[number]; active: boolean; favorite: boolean; onPress: () => void; onToggleFavorite: () => void }) {
  return (
    <View style={[styles.navButton, active && styles.navButtonActive]}>
      <Pressable onPress={onPress} style={styles.navButtonBody}>
        <Ionicons name={item.icon} size={17} color={active ? palette.text : palette.muted} />
        <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
        {active ? <View style={styles.activeRail} /> : null}
      </Pressable>
      <Pressable onPress={onToggleFavorite} accessibilityRole="button" accessibilityLabel={`${favorite ? "Quitar" : "Agregar"} ${item.label} ${favorite ? "de" : "a"} favoritos`} style={styles.navFavorite}>
        <Ionicons name={favorite ? "star" : "star-outline"} size={14} color={favorite ? "#E5E5E7" : palette.faint} />
      </Pressable>
    </View>
  );
}

function MobileDrawer({ section, onSelect, onClose, userName, userEmail, connected }: { section: Section; onSelect: (section: Section) => void; onClose: () => void; userName?: string | null; userEmail?: string | null; connected: boolean }) {
  const [filter, setFilter] = useState("");
  const [favorites, setFavorites] = useState<Section[]>(["overview", "licenses"]);
  const visible = navigation.filter((item) => item.label.toLowerCase().includes(filter.toLowerCase()));
  const toggleFavorite = (id: Section) => setFavorites((current) => current.includes(id) ? current.filter((favorite) => favorite !== id) : [...current, id]);
  return (
    <View style={styles.drawerLayer}>
      <Pressable onPress={onClose} style={styles.drawerBackdrop} />
      <View style={styles.drawerPanel}>
        <View style={styles.mobileDrawerHeader}>
          <View style={styles.workspaceHeading}><BrandMark small /><View style={{ flex: 1 }}><Text style={styles.workspaceName}>ALKAPONEDOLLAR</Text><Text style={styles.workspaceSub}>CONTROL CENTER</Text></View></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={onClose} style={styles.mobileDrawerClose}><Ionicons name="close" size={19} color={palette.muted} /></Pressable>
        </View>
        <View style={styles.mobileDrawerAccount}><View style={styles.accountAvatar}><Image source={alkaponeAvatar} style={styles.avatarImage} /></View><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.accountName}>{userName || "Mi cuenta"}</Text><Text numberOfLines={1} style={styles.accountEmail}>{userEmail || "Acceso de propietario"}</Text></View><Ionicons name="chevron-down" size={14} color={palette.faint} /></View>
        <View style={styles.quickSearch}><Ionicons name="search" size={15} color={palette.faint} /><TextInput value={filter} onChangeText={setFilter} placeholder="Buscar sección" placeholderTextColor={palette.faint} style={styles.quickSearchInput} /></View>
        <ScrollView style={styles.mobileDrawerNav} contentContainerStyle={styles.sidebarNavContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.navGroup}>GESTIÓN</Text>
          {visible.filter((item) => ["overview", "applications", "licenses", "policies", "machines"].includes(item.id)).map((item) => <NavButton key={item.id} item={item} active={section === item.id} favorite={favorites.includes(item.id)} onPress={() => onSelect(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} />)}
          <Text style={[styles.navGroup, styles.navGroupSpaced]}>MONITOREO</Text>
          {visible.filter((item) => ["security", "activity"].includes(item.id)).map((item) => <NavButton key={item.id} item={item} active={section === item.id} favorite={favorites.includes(item.id)} onPress={() => onSelect(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} />)}
          <Text style={[styles.navGroup, styles.navGroupSpaced]}>CONEXIONES</Text>
          {visible.filter((item) => ["tokens", "integration", "settings"].includes(item.id)).map((item) => <NavButton key={item.id} item={item} active={section === item.id} favorite={favorites.includes(item.id)} onPress={() => onSelect(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} />)}
        </ScrollView>
        <Pressable onPress={() => onSelect("integration")} style={styles.sidebarConnection}><View style={[styles.sidebarConnectionDot, { backgroundColor: connected ? palette.accent : palette.faint }]} /><View style={{ flex: 1 }}><Text style={styles.sidebarConnectionTitle}>KEYGEN API</Text><Text style={styles.sidebarConnectionSub}>{connected ? "Cuenta conectada" : "Conexión pendiente"}</Text></View><Ionicons name="chevron-forward" size={14} color={palette.faint} /></Pressable>
        <Pressable onPress={() => onSelect("settings")} style={styles.mobileDrawerSettings}><Ionicons name="settings-outline" size={16} color={palette.muted} /><Text style={styles.mobileDrawerSettingsText}>Cuenta y ajustes</Text><Ionicons name="chevron-forward" size={14} color={palette.faint} /></Pressable>
      </View>
    </View>
  );
}

function LoadingScreen() {
  return <View style={styles.loadingScreen}><BrandMark /><ActivityIndicator color={palette.accent} size="small" /><Text style={styles.loadingText}>Verificando tu sesión…</Text></View>;
}

function LoginScreen({ onLogin, busy, error, notice }: { onLogin: (username: string, key: string) => void | Promise<void>; busy: boolean; error: string; notice: string }) {
  const { width } = useWindowDimensions();
  const compact = width < 660;
  const [username, setUsername] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const canSubmit = username.trim().length > 0 && licenseKey.trim().length >= 8 && !busy;
  const submit = () => {
    const submittedKey = licenseKey.trim();
    if (!username.trim() || submittedKey.length < 8 || busy) return;
    setLicenseKey("");
    void onLogin(username.trim(), submittedKey);
  };
  return (
    <View style={[styles.loginRoot, styles.referenceLoginRoot, { minHeight: "100vh" as any, paddingHorizontal: compact ? 14 : 24, paddingVertical: compact ? 14 : 20 }]}>
      <View style={[styles.loginHeader, styles.referenceLoginHeader]}>
        <View style={styles.referenceBrand}><View style={styles.referenceMiniAvatar}><Image source={alkaponeAvatar} style={styles.referenceMiniAvatarImage} resizeMode="cover" /></View><View><Text style={styles.referenceBrandName}>ALKAPONE DOLLAR</Text><Text style={styles.referenceBrandSub}>V1.0  ·  CONTROL CENTER</Text></View></View>
        <View style={styles.referenceSecurePill}><View style={styles.referenceSecureDot} /><Text style={styles.referenceSecureText}>LICENCIA SEGURA</Text></View>
      </View>
      <ScrollView style={styles.loginScroll} contentContainerStyle={styles.referenceLoginScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.referenceLoginContent, { maxWidth: compact ? 430 : 470 }]}>
          <View style={styles.referenceHeroAvatar}><Image source={alkaponeAvatar} style={styles.referenceHeroImage} resizeMode="cover" /></View>
          <Text style={styles.referenceEyebrow}>TU ESPACIO DE ADMINISTRACIÓN</Text>
          <Text style={styles.referenceHeroTitle}>Login</Text>
          <Text style={styles.referenceHeroDescription}>Protege tus aplicaciones, administra licencias y controla tus productos desde un solo lugar.</Text>
          <View style={styles.referenceLoginCard}>
            <View style={styles.referenceCardHeading}><View style={styles.referenceCardIcon}><Ionicons name="shield-checkmark-outline" size={19} color={palette.text} /></View><View style={{ flex: 1 }}><Text style={styles.referenceCardTitle}>Acceso a tu cuenta</Text><Text style={styles.referenceCardSub}>Verificamos tu licencia con Keygen</Text></View></View>
            <View style={styles.referenceInputGroup}>
              <Text style={styles.referenceInputLabel}>NOMBRE DE USUARIO</Text>
              <View style={styles.referenceInputShell}><Ionicons name="person-outline" size={17} color={palette.muted} /><TextInput value={username} onChangeText={setUsername} placeholder="Tu nombre de usuario" placeholderTextColor={palette.faint} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" style={styles.referenceInput} returnKeyType="next" /></View>
            </View>
            <View style={styles.referenceInputGroup}>
              <Text style={styles.referenceInputLabel}>CLAVE DE LICENCIA</Text>
              <View style={styles.referenceInputShell}><Ionicons name="key-outline" size={17} color={palette.muted} /><TextInput value={licenseKey} onChangeText={setLicenseKey} placeholder="XXXX-XXXX-XXXX-XXXX" placeholderTextColor={palette.faint} autoCapitalize="characters" autoCorrect={false} autoComplete="off" secureTextEntry={!showKey} textContentType="password" style={styles.referenceInput} returnKeyType="go" onSubmitEditing={submit} /><Pressable accessibilityRole="button" accessibilityLabel={showKey ? "Ocultar clave" : "Mostrar clave"} onPress={() => setShowKey((visible) => !visible)} style={styles.referenceEyeButton}><Ionicons name={showKey ? "eye-off-outline" : "eye-outline"} size={18} color={palette.muted} /></Pressable></View>
            </View>
            {error ? <View style={styles.referenceMessageError}><Ionicons name="alert-circle-outline" size={15} color="#D7D7D9" /><Text style={styles.referenceMessageText}>{error}</Text></View> : null}
            {notice ? <View style={styles.referenceMessageNotice}><Ionicons name="checkmark-circle-outline" size={15} color={palette.text} /><Text style={styles.referenceMessageText}>{notice}</Text></View> : null}
            <Pressable accessibilityRole="button" disabled={!canSubmit} onPress={submit} style={({ pressed }) => [styles.referenceLoginButton, !canSubmit && styles.referenceLoginButtonDisabled, pressed && canSubmit && { opacity: 0.88 }]}>
              <Text style={styles.referenceLoginButtonText}>{busy ? "Verificando licencia…" : "Iniciar sesión"}</Text>{busy ? <ActivityIndicator size="small" color="#101113" /> : <Ionicons name="arrow-forward" size={18} color="#101113" />}
            </Pressable>
            <Text style={styles.referencePrivacyNote}>La clave se verifica con Keygen. No se guarda en este dispositivo.</Text>
          </View>
          <Text style={styles.referenceOwnerNote}>Acceso protegido por username y licencia de Keygen.</Text>
        </View>
      </ScrollView>
      <Text style={styles.referenceFooter}>ALKAPONEDOLLAR  ·  PRIVATE SOFTWARE CONSOLE</Text>
    </View>
  );
}

function ModalLayer({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <View style={styles.modalLayer}>
      <Pressable onPress={onClose} style={styles.modalBackdrop} />
      <View style={[styles.modalCenter, wide && styles.modalCenterWide]}>{children}</View>
    </View>
  );
}

function ModalContent({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  return (
    <View style={[styles.modalCard, compact && styles.modalCardCompact, wide && styles.modalCardWide]}>
      <View style={styles.modalHeader}><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.modalTitle}>{title}</Text><Text style={styles.modalSubtitle}>{subtitle}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar ventana" onPress={onClose} style={styles.modalClose}><Ionicons name="close" size={19} color={palette.muted} /></Pressable></View>
      <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>{children}</ScrollView>
    </View>
  );
}

function FormField({ label, value, placeholder, onChange, helper, style, multiline = false, keyboardType, type }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; helper?: string; style?: object; multiline?: boolean; keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"]; type?: "date" | "datetime-local" | "time" }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <TextInput {...(type ? ({ type } as any) : {})} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={palette.faint} style={[styles.formInput, multiline && styles.formInputMultiline]} autoCapitalize="none" keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} />
      {helper ? <Text style={styles.cardMuted}>{helper}</Text> : null}
    </View>
  );
}

function ChoiceGroup({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <View style={{ gap: 7 }}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.choiceRow}>{options.map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.value === value }} onPress={() => onChange(option.value)} style={[styles.choiceChip, option.value === value && styles.choiceChipActive]}><Text style={[styles.choiceChipText, option.value === value && styles.choiceChipTextActive]}>{option.label}</Text></Pressable>)}</View></View>;
}

function ToggleField({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.toggleField}><View style={{ flex: 1 }}><Text style={styles.policyTitle}>{label}</Text><Text style={styles.policySubtitle}>{description}</Text></View><View style={[styles.toggleTrack, value && styles.toggleTrackActive]}><View style={[styles.toggleThumb, value && styles.toggleThumbActive]} /></View></Pressable>;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  }
}

const styles = {
  shell: { flex: 1, flexDirection: "row" as const, backgroundColor: palette.bg, color: palette.text },
  sidebar: { width: 320, backgroundColor: "#090A0B", borderRightWidth: 1, borderRightColor: palette.border, minHeight: "100vh" as any, flexDirection: "row" as const },
  iconRail: { width: 56, alignItems: "center" as const, backgroundColor: "#08090A", borderRightWidth: 1, borderRightColor: palette.border, paddingTop: 12, paddingBottom: 12 },
  railBrand: { marginBottom: 12 },
  railDivider: { width: 24, height: 1, backgroundColor: palette.border, marginBottom: 12 },
  railButton: { width: 36, height: 36, borderRadius: 10, alignItems: "center" as const, justifyContent: "center" as const, marginVertical: 4 },
  railButtonActive: { backgroundColor: "#25272B", borderWidth: 1, borderColor: "#36383D" },
  railAvatar: { width: 30, height: 30, borderRadius: 15, overflow: "hidden" as const, marginTop: 10, borderWidth: 1, borderColor: "#4A4C52" },
  railAvatarImage: { width: 28, height: 28, borderRadius: 14 },
  sidePanel: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, flexDirection: "column" as const },
  workspaceHeading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginBottom: 15, minHeight: 39 },
  workspaceName: { color: palette.text, fontSize: 10, fontWeight: "900" as const, letterSpacing: 1.05 },
  workspaceSub: { color: palette.faint, fontSize: 8, fontWeight: "700" as const, letterSpacing: 1.1, marginTop: 3 },
  quickSearch: { height: 36, flexDirection: "row" as const, alignItems: "center" as const, gap: 7, paddingHorizontal: 9, backgroundColor: "#111214", borderWidth: 1, borderColor: palette.border, borderRadius: 8 },
  quickSearchInput: { flex: 1, minWidth: 0, color: palette.text, fontSize: 10, outlineStyle: "none" as any, paddingVertical: 5 },
  searchShortcut: { color: palette.faint, fontSize: 8, borderWidth: 1, borderColor: palette.border, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  sidebarNavScroll: { flex: 1, minHeight: 0 as any, marginTop: 17 },
  sidebarNavContent: { paddingBottom: 12 },
  navGroupSpaced: { marginTop: 21 },
  brandRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingLeft: 5, marginBottom: 32 },
  brandMark: { width: 37, height: 37, borderRadius: 11, backgroundColor: "#111214", borderWidth: 1, borderColor: "#414348", alignItems: "center" as const, justifyContent: "center" as const, overflow: "hidden" as const },
  brandMarkSmall: { width: 37, height: 37, borderRadius: 11 },
  brandImage: { width: "100%" as const, height: "100%" as const },
  brandImageSmall: { width: "100%" as const, height: "100%" as const },
  brandHex: { width: 19, height: 20, borderWidth: 1.5, borderColor: palette.accent, borderRadius: 5, transform: [{ rotate: "30deg" }] },
  brandHexSmall: { width: 21, height: 22 },
  brandKeyRing: { width: 6, height: 6, borderRadius: 99, borderWidth: 1.4, borderColor: palette.accent, position: "absolute" as const, left: 5, top: 5 },
  brandKeyStem: { width: 8, height: 2, backgroundColor: palette.accent, position: "absolute" as const, right: 1, bottom: 4, transform: [{ rotate: "-45deg" }] },
  brandName: { color: palette.text, fontSize: 13, fontWeight: "900" as const, letterSpacing: 1.6 },
  brandSub: { color: palette.faint, fontSize: 7, fontWeight: "800" as const, letterSpacing: 1.35, marginTop: 3 },
  navGroup: { color: "#85878D", fontSize: 9, fontWeight: "800" as const, letterSpacing: 1.6, marginLeft: 10, marginBottom: 8 },
  navButton: { height: 40, paddingHorizontal: 4, borderRadius: 9, flexDirection: "row" as const, alignItems: "center" as const, marginVertical: 2, position: "relative" as const },
  navButtonActive: { backgroundColor: "#25272B" },
  navButtonBody: { flex: 1, height: 40, paddingHorizontal: 7, borderRadius: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, position: "relative" as const },
  navFavorite: { width: 28, height: 40, alignItems: "center" as const, justifyContent: "center" as const },
  navLabel: { color: palette.muted, fontSize: 11, fontWeight: "600" as const, flex: 1 },
  navLabelActive: { color: palette.text, fontWeight: "800" as const },
  activeRail: { position: "absolute" as const, left: -11, top: 9, bottom: 9, width: 2, backgroundColor: palette.accent, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  sidebarConnection: { backgroundColor: "#151619", borderWidth: 1, borderColor: "#36383D", borderRadius: 9, padding: 9, flexDirection: "row" as const, alignItems: "center" as const, gap: 8, marginTop: 10, marginBottom: 10 },
  sidebarConnectionDot: { width: 7, height: 7, borderRadius: 99 },
  sidebarConnectionTitle: { color: palette.text, fontSize: 9, fontWeight: "800" as const },
  sidebarConnectionSub: { color: palette.muted, fontSize: 8, marginTop: 3 },
  sidebarUser: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 11, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  sidebarVersion: { color: "#686A70", fontSize: 8, letterSpacing: 1, textAlign: "center" as const, marginTop: 16 },
  accountAvatar: { width: 31, height: 31, borderRadius: 10, backgroundColor: "#2A2C30", borderWidth: 1, borderColor: "#55575B", alignItems: "center" as const, justifyContent: "center" as const, overflow: "hidden" as const },
  avatarImage: { width: "100%" as const, height: "100%" as const, borderRadius: 9 },
  accountAvatarText: { color: palette.accent, fontSize: 12, fontWeight: "900" as const },
  accountName: { color: palette.text, fontSize: 10, fontWeight: "700" as const },
  accountEmail: { color: palette.faint, fontSize: 9, marginTop: 3 },
  appMain: { flex: 1, minWidth: 0, backgroundColor: palette.bg },
  topbar: { minHeight: 66, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: palette.border, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, backgroundColor: "#0B0C0E", zIndex: 5 },
  menuButton: { width: 44, height: 44, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: palette.raised, borderWidth: 1, borderColor: palette.border },
  topbarTitleWrap: { flex: 1 },
  breadcrumb: { color: "#D4D5D8", fontSize: 10, fontWeight: "800" as const, letterSpacing: 1.1 },
  topbarSub: { color: palette.faint, fontSize: 9, marginTop: 4, textTransform: "capitalize" as const },
  topbarRight: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  connectionTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 9 },
  connectionDot: { width: 7, height: 7, borderRadius: 99 },
  connectionTopText: { color: palette.muted, fontSize: 9, fontWeight: "700" as const },
  topbarDivider: { width: 1, height: 27, backgroundColor: palette.border, marginHorizontal: 3 },
  contentScroll: { paddingTop: 24, paddingBottom: 28, alignItems: "center" as const, gap: 25, flexGrow: 1 },
  contentInner: { width: "100%" as const },
  footerNote: { color: "#66696F", fontSize: 8, letterSpacing: 1.05, textAlign: "center" as const },
  drawerLayer: { position: "absolute" as const, top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, flexDirection: "row" as const },
  drawerBackdrop: { position: "absolute" as const, top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.62)" },
  drawerPanel: { width: 320, maxWidth: "88%" as const, height: "100%" as any, zIndex: 1, backgroundColor: "#090A0B", elevation: 15 },
  drawerClose: { position: "absolute" as const, top: 16, right: 14, width: 44, height: 44, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const, zIndex: 2 },
  loadingScreen: { flex: 1, backgroundColor: palette.bg, alignItems: "center" as const, justifyContent: "center" as const, gap: 13, minHeight: "100vh" as any },
  loadingText: { color: palette.muted, fontSize: 11 },
  loginRoot: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 34, paddingVertical: 22 },
  loginScroll: { flex: 1 },
  loginHeader: { maxWidth: 1240, width: "100%" as const, alignSelf: "center" as const, flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const },
  loginHeaderCompact: { flexWrap: "wrap" as const, gap: 10, alignItems: "center" as const },
  loginBrandRow: { marginBottom: 0, paddingLeft: 0 },
  loginMain: { flexGrow: 1, width: "100%" as const, maxWidth: 1080, alignSelf: "center" as const, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 48, paddingVertical: 30, flexWrap: "wrap" as const },
  loginMainCompact: { flexGrow: 0, maxWidth: 560, flexDirection: "column" as const, alignItems: "stretch" as const, justifyContent: "flex-start" as const, gap: 12, paddingVertical: 8, flexWrap: "nowrap" as const },
  loginCopy: { flex: 1, minWidth: 290, maxWidth: 550 },
  loginPortraitWrap: { width: 196, height: 196, borderRadius: 18, borderWidth: 1, borderColor: "#4A4C52", overflow: "hidden" as const, backgroundColor: "#111214", marginBottom: 20, position: "relative" as const },
  loginPortraitWrapCompact: { width: 96, height: 96, borderRadius: 13, marginBottom: 8, alignSelf: "center" as const },
  loginPortrait: { width: "100%" as const, height: "100%" as const },
  loginPortraitCaption: { position: "absolute" as const, left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "rgba(0,0,0,0.70)" },
  loginPortraitLabel: { color: "#F1F1F3", fontSize: 8, fontWeight: "900" as const, letterSpacing: 1.1 },
  loginPortraitSub: { color: "#B3B5B9", fontSize: 7, fontWeight: "700" as const, letterSpacing: 0.9, marginTop: 2 },
  loginEyebrow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, marginBottom: 18 },
  loginEyebrowCompact: { marginBottom: 10 },
  loginEyebrowDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: palette.accent },
  loginEyebrowText: { color: palette.accent, fontSize: 9, fontWeight: "800" as const, letterSpacing: 1.8 },
  loginHeadline: { color: palette.text, fontSize: 48, lineHeight: 55, fontWeight: "900" as const, letterSpacing: -2.2 },
  loginHeadlineCompact: { fontSize: 34, lineHeight: 38, letterSpacing: -1.4 },
  loginDescription: { color: palette.muted, fontSize: 14, lineHeight: 22, maxWidth: 455, marginTop: 15 },
  loginDescriptionCompact: { fontSize: 12, lineHeight: 18, marginTop: 9 },
  loginFeatures: { marginTop: 32, gap: 18 },
  loginFeaturesCompact: { marginTop: 12, gap: 8 },
  loginFeature: { flexDirection: "row" as const, alignItems: "center" as const, gap: 11 },
  loginFeatureIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#222427", alignItems: "center" as const, justifyContent: "center" as const },
  loginFeatureTitle: { color: palette.text, fontSize: 11, fontWeight: "800" as const },
  loginFeatureDescription: { color: palette.faint, fontSize: 10, marginTop: 4 },
  loginCardWrap: { width: 360, maxWidth: "100%" as const },
  loginCard: { padding: 26, backgroundColor: "#111214" },
  loginCardCompact: { padding: 17 },
  loginCardMark: { marginBottom: 18 },
  loginCardTitle: { color: palette.text, fontSize: 23, fontWeight: "900" as const, letterSpacing: -0.5 },
  loginCardText: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 8, marginBottom: 22 },
  loginCardTextCompact: { marginBottom: 10 },
  loginButton: { height: 46, backgroundColor: palette.accent, borderRadius: 11, paddingHorizontal: 13, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  loginButtonText: { color: palette.bg, fontSize: 12, fontWeight: "900" as const, flex: 1, textAlign: "center" as const },
  loginSeparator: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, marginTop: 21, marginBottom: 16 },
  loginSeparatorCompact: { marginTop: 8, marginBottom: 7 },
  loginRule: { flex: 1, height: 1, backgroundColor: palette.border },
  loginOr: { color: palette.faint, fontSize: 8, fontWeight: "800" as const, letterSpacing: 1.1 },
  loginSecurityRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9, marginTop: 8 },
  loginSecurityText: { color: "#C7C8CC", fontSize: 10 },
  loginLegal: { color: palette.faint, textAlign: "center" as const, fontSize: 9, lineHeight: 14, marginTop: 12 },
  loginLegalCompact: { marginTop: 7 },
  loginFooter: { maxWidth: 1240, width: "100%" as const, alignSelf: "center" as const, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 13, flexDirection: "row" as const, justifyContent: "space-between" as const, flexWrap: "wrap" as const, gap: 9 },
  loginFooterText: { color: "#707278", fontSize: 8, fontWeight: "700" as const, letterSpacing: 1 },
  modalLayer: { position: "absolute" as const, top: 0, right: 0, bottom: 0, left: 0, zIndex: 80, alignItems: "center" as const, justifyContent: "center" as const, padding: 15 },
  modalBackdrop: { position: "absolute" as const, top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(2,6,10,0.78)" },
  modalCenter: { width: "100%" as const, maxWidth: 510, maxHeight: "90%" as any },
  modalCard: { backgroundColor: "#111214", borderWidth: 1, borderColor: "#3B3D42", borderRadius: 17, padding: 20, elevation: 16, maxHeight: "100%" as any },
  modalCardCompact: { padding: 14, borderRadius: 14 },
  modalHeader: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 14, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: palette.border },
  modalTitle: { color: palette.text, fontSize: 18, fontWeight: "900" as const },
  modalSubtitle: { color: palette.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  modalClose: { width: 44, height: 44, borderRadius: 11, backgroundColor: palette.raised, alignItems: "center" as const, justifyContent: "center" as const, flexShrink: 0 },
  modalBody: { paddingTop: 16, gap: 13 },
  connectModalNotice: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 10, padding: 12, borderRadius: 11, borderWidth: 1, borderColor: "#3D3F44", backgroundColor: "#1B1C20" },
  connectModalText: { color: "#CACBCD", fontSize: 10, lineHeight: 17, flex: 1 },
  modalIssue: { color: "#CFD0D3", fontSize: 10, lineHeight: 16 },
  modalActions: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "flex-end" as const, gap: 9, marginTop: 4 },
  fieldLabel: { color: "#C3C4C8", fontSize: 9, fontWeight: "800" as const, letterSpacing: 0.8 },
  formInput: { height: 42, borderRadius: 9, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border, color: palette.text, paddingHorizontal: 11, fontSize: 11, outlineStyle: "none" as any },
  cardMuted: { color: palette.muted, fontSize: 10, lineHeight: 16 },
  inlineLoading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, minHeight: 28 },
  policyChoice: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.bg, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingHorizontal: 11 },
  policySelected: { borderColor: palette.accent, backgroundColor: "#1B1C20" },
  radio: { width: 14, height: 14, borderRadius: 99, borderWidth: 1, borderColor: palette.faint },
  radioSelected: { backgroundColor: palette.accent, borderColor: palette.accent, shadowColor: palette.accent, shadowRadius: 4, shadowOpacity: 0.4 },
  policyTitle: { color: palette.text, fontSize: 10, fontWeight: "700" as const },
  policySubtitle: { color: palette.faint, fontSize: 9, marginTop: 3 },
  emptyPolicy: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, padding: 10, backgroundColor: "#232427", borderRadius: 9 },
  resultCard: { alignItems: "center" as const, gap: 10, padding: 16, borderWidth: 1, borderColor: "#3D3F44", borderRadius: 12, backgroundColor: "#1B1C20" },
  resultLabel: { color: palette.accent, fontSize: 8, fontWeight: "900" as const, letterSpacing: 1.4 },
  resultKey: { color: palette.text, fontSize: 12, fontWeight: "800" as const, fontFamily: "monospace", textAlign: "center" as const, lineHeight: 21 },
  referenceLoginRoot: { backgroundColor: "#070809" },
  referenceLoginHeader: { maxWidth: 1240, paddingHorizontal: 2, minHeight: 44, flexShrink: 0 },
  referenceBrand: { flexDirection: "row" as const, alignItems: "center" as const, gap: 9 },
  referenceMiniAvatar: { width: 31, height: 31, borderRadius: 99, overflow: "hidden" as const, borderWidth: 1, borderColor: "#D7D8DA", backgroundColor: "#111214" },
  referenceMiniAvatarImage: { width: "100%" as const, height: "100%" as const },
  referenceBrandName: { color: "#F1F1F2", fontSize: 9, fontWeight: "900" as const, letterSpacing: 1.5 },
  referenceBrandSub: { color: "#73757A", fontSize: 7, fontWeight: "700" as const, letterSpacing: 1.3, marginTop: 3 },
  referenceSecurePill: { minHeight: 26, borderRadius: 99, borderWidth: 1, borderColor: "#303236", paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  referenceSecureDot: { width: 5, height: 5, borderRadius: 99, backgroundColor: "#D7D8DA" },
  referenceSecureText: { color: "#B8B9BC", fontSize: 7, fontWeight: "800" as const, letterSpacing: 1.1 },
  referenceLoginScroll: { flexGrow: 1, width: "100%" as const, alignItems: "center" as const, justifyContent: "center" as const, paddingVertical: 14 },
  referenceLoginContent: { width: "100%" as const, alignItems: "center" as const, alignSelf: "center" as const },
  referenceHeroAvatar: { width: 78, height: 78, borderRadius: 99, padding: 4, borderWidth: 2, borderColor: "#D6D7D9", overflow: "hidden" as const, backgroundColor: "#101113", marginBottom: 17 },
  referenceHeroImage: { width: "100%" as const, height: "100%" as const, borderRadius: 99 },
  referenceEyebrow: { color: "#A7A8AC", fontSize: 8, fontWeight: "800" as const, letterSpacing: 2.1, textAlign: "center" as const, marginBottom: 8 },
  referenceHeroTitle: { color: "#F5F5F6", fontSize: 33, lineHeight: 37, fontWeight: "900" as const, letterSpacing: -1.25, textAlign: "center" as const },
  referenceHeroMuted: { color: "#77797E" },
  referenceHeroDescription: { maxWidth: 355, color: "#A1A2A6", fontSize: 11, lineHeight: 17, textAlign: "center" as const, marginTop: 10, marginBottom: 18 },
  referenceLoginCard: { width: "100%" as const, padding: 17, backgroundColor: "#111214", borderRadius: 19, borderWidth: 1, borderColor: "#282A2E", gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowRadius: 28, shadowOpacity: 0.32, elevation: 12 },
  referenceCardHeading: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 1 },
  referenceCardIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#202124", alignItems: "center" as const, justifyContent: "center" as const },
  referenceCardTitle: { color: "#F0F0F1", fontSize: 12, fontWeight: "800" as const },
  referenceCardSub: { color: "#888A8F", fontSize: 9, marginTop: 4 },
  referenceInputGroup: { gap: 6 },
  referenceInputLabel: { color: "#B8B9BC", fontSize: 8, fontWeight: "900" as const, letterSpacing: 1.35 },
  referenceInputShell: { minHeight: 44, paddingHorizontal: 11, flexDirection: "row" as const, alignItems: "center" as const, gap: 9, backgroundColor: "#08090A", borderWidth: 1, borderColor: "#303236", borderRadius: 10 },
  referenceInput: { flex: 1, minWidth: 0, color: "#ECEDEF", fontSize: 11, paddingVertical: 10, outlineStyle: "none" as any },
  referenceEyeButton: { width: 27, height: 34, alignItems: "center" as const, justifyContent: "center" as const },
  referenceMessageError: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 7, padding: 9, borderRadius: 8, backgroundColor: "#26272A", borderWidth: 1, borderColor: "#484A4F" },
  referenceMessageNotice: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 7, padding: 9, borderRadius: 8, backgroundColor: "#202124", borderWidth: 1, borderColor: "#45474B" },
  referenceMessageText: { flex: 1, color: "#D5D6D8", fontSize: 9, lineHeight: 14 },
  referenceLoginButton: { minHeight: 44, paddingHorizontal: 15, borderRadius: 10, backgroundColor: "#E8E8E9", flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10, marginTop: 1 },
  referenceLoginButtonDisabled: { backgroundColor: "#77797D", opacity: 0.56 },
  referenceLoginButtonText: { color: "#111214", fontSize: 11, fontWeight: "900" as const },
  referencePrivacyNote: { color: "#85868A", fontSize: 8, lineHeight: 13, textAlign: "left" as const },
  referenceOwnerNote: { color: "#73757A", fontSize: 8, lineHeight: 13, textAlign: "center" as const, maxWidth: 380, marginTop: 10 },
  referenceFooter: { width: "100%" as const, maxWidth: 1240, alignSelf: "center" as const, color: "#5E6065", fontSize: 7, fontWeight: "700" as const, letterSpacing: 1.2, textAlign: "center" as const, paddingTop: 8, flexShrink: 0 },
  choiceRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7 },
  choiceChip: { minHeight: 34, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: "#34363A", backgroundColor: "#111214", justifyContent: "center" as const },
  choiceChipActive: { backgroundColor: "#292B2F", borderColor: "#77797E" },
  choiceChipText: { color: "#A8A9AD", fontSize: 9, fontWeight: "700" as const },
  choiceChipTextActive: { color: "#F0F0F1" },
  toggleStack: { gap: 7 },
  toggleField: { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#303236", backgroundColor: "#151619" },
  toggleTrack: { width: 34, height: 19, borderRadius: 99, padding: 2, backgroundColor: "#414348", justifyContent: "center" as const },
  toggleTrackActive: { backgroundColor: "#C8C9CB" },
  toggleThumb: { width: 15, height: 15, borderRadius: 99, backgroundColor: "#DFE0E1" },
  toggleThumbActive: { alignSelf: "flex-end" as const, backgroundColor: "#151619" },
  tokenSecretCard: { padding: 14, gap: 9, backgroundColor: "#08090A", borderWidth: 1, borderColor: "#3A3C40", borderRadius: 10 },
  tokenSecretValue: { color: "#F3F3F4", fontFamily: "monospace", fontSize: 11, lineHeight: 18 },
  editorFieldsGrid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 12 },
  editorField: { flexGrow: 1, flexBasis: "42%" as any, minWidth: 180 },
  editorFieldFull: { width: "100%" as const },
  editReadonlyCard: { padding: 12, gap: 9, backgroundColor: "#151619", borderWidth: 1, borderColor: "#33353A", borderRadius: 11 },
  editReadonlyTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
  editorToggle: { minHeight: 51, flexDirection: "row" as const, alignItems: "center" as const, gap: 10, padding: 10, borderWidth: 1, borderColor: "#33353A", borderRadius: 9, backgroundColor: "#151619" },
  editorCheck: { width: 19, height: 19, borderWidth: 1, borderColor: "#6A6C71", borderRadius: 5, alignItems: "center" as const, justifyContent: "center" as const },
  editorCheckActive: { backgroundColor: "#D5D6D8", borderColor: "#D5D6D8" },
  editorSectionHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 10 },
  usageActions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 7 },
  usageButton: { minHeight: 33, borderRadius: 8, borderWidth: 1, borderColor: "#3A3C40", paddingHorizontal: 10, justifyContent: "center" as const, backgroundColor: "#1A1B1F" },
  modalNotice: { padding: 10, backgroundColor: "#202124", borderColor: "#3A3C40", borderWidth: 1, borderRadius: 9 },
  mobileDrawerHeader: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: palette.border },
  mobileDrawerClose: { width: 30, height: 30, borderRadius: 9, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: "#1A1B1F" },
  mobileDrawerAccount: { paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  mobileDrawerNav: { flex: 1, minHeight: 0 as any, paddingHorizontal: 11 },
  mobileDrawerSettings: { padding: 14, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row" as const, alignItems: "center" as const, gap: 9 },
  mobileDrawerSettingsText: { color: palette.muted, fontSize: 10, fontWeight: "700" as const },
  modalCenterWide: { maxWidth: 860 },
  modalCardWide: { width: "100%" as const, maxWidth: 840, alignSelf: "center" as const },
  modalScroll: { flexShrink: 1, maxHeight: "72vh" as any },
  formInputMultiline: { height: 100, paddingTop: 10, paddingBottom: 10 },
};
