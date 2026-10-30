export type KeygenResource = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data?: { id?: string; type?: string } | null }>;
};

export type KeygenAuditEvent = {
  id: string;
  event: string;
  created: string | null;
  resourceType: string;
  resourceId: string;
  actorType: string;
};

export type KeygenProductTokenSummary = {
  id: string;
  name: string;
  kind: string;
  permissions: string[];
  created: string | null;
};

export type KeygenCreatedProductToken = KeygenProductTokenSummary & { secret: string };

export type KeygenLicenseSummary = KeygenResource & {
  maskedKey: string;
  productId: string | null;
  productName: string;
  policyId: string | null;
};

export type KeygenLicenseDetails = {
  id: string;
  name: string;
  expiry: string | null;
  status: string;
  uses: number;
  protected: boolean;
  suspended: boolean;
  maxMachines: number | null;
  maxProcesses: number | null;
  maxUsers: number | null;
  maxCores: number | null;
  maxMemory: number | null;
  maxDisk: number | null;
  maxUses: number | null;
  permissions: string[];
  metadata: Record<string, unknown>;
  productId: string | null;
  productName: string;
  policyId: string | null;
  policyName: string;
  ownerId: string | null;
  groupId: string | null;
  maskedKey: string;
};

export type KeygenLicenseEditableAttributes = {
  name: string;
  expiry: string | null;
  protected: boolean;
  maxMachines: number | null;
  maxProcesses: number | null;
  maxUsers: number | null;
  maxCores: number | null;
  maxMemory: number | null;
  maxDisk: number | null;
  maxUses: number | null;
  permissions: string[];
  metadata: Record<string, unknown>;
};

type KeygenDocument = {
  data?: KeygenResource | KeygenResource[];
  included?: KeygenResource[];
  meta?: Record<string, unknown>;
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
};

export type KeygenFailureKind = "not_configured" | "unauthorized" | "forbidden" | "invalid_request" | "unavailable";

export class KeygenFailure extends Error {
  constructor(
    public readonly kind: KeygenFailureKind,
    message: string,
  ) {
    super(message);
    this.name = "KeygenFailure";
  }
}

function getConnection() {
  const account = process.env.KEYGEN_ACCOUNT_ID?.trim();
  const token = process.env.KEYGEN_API_TOKEN?.trim();
  if (!account || !token) {
    throw new KeygenFailure("not_configured", "Falta configurar la cuenta o el token de Keygen.");
  }
  return { account, token };
}

async function keygenRequest<T extends KeygenDocument>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { account, token } = getConnection();
  const url = `https://api.keygen.sh/v1/accounts/${encodeURIComponent(account)}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "application/vnd.api+json",
        ...(init.body ? { "Content-Type": "application/vnd.api+json" } : {}),
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
  } catch {
    throw new KeygenFailure("unavailable", "Keygen no respondió. Intenta de nuevo en unos minutos.");
  }

  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    if (response.status === 401) {
      throw new KeygenFailure("unauthorized", "Keygen rechazó el token configurado.");
    }
    if (response.status === 403) {
      throw new KeygenFailure("forbidden", "El token no tiene permisos para esta operación.");
    }
    if (response.status === 422) {
      throw new KeygenFailure("invalid_request", "Keygen rechazó los cambios. Verifica los límites, la policy y los valores requeridos.");
    }
    if (response.status === 429 || response.status >= 500) {
      throw new KeygenFailure("unavailable", "Keygen no pudo completar la solicitud. Intenta más tarde.");
    }
    throw new KeygenFailure("unavailable", "Keygen devolvió una respuesta no válida para esta operación.");
  }
  return payload;
}

function collection(document: KeygenDocument): KeygenResource[] {
  return Array.isArray(document.data) ? document.data : document.data ? [document.data] : [];
}

function relationshipId(resource: KeygenResource, name: string): string | null {
  return resource.relationships?.[name]?.data?.id ?? null;
}

function maskedLicenseKey(value: unknown): string {
  if (typeof value !== "string" || value.length < 10) return "Clave protegida";
  return `${value.slice(0, 5)}••••${value.slice(-4)}`;
}

function numericOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function validateKeygenLicenseKey(input: { key: string; username?: string }) {
  const account = process.env.KEYGEN_ACCOUNT_ID?.trim();
  if (!account) throw new KeygenFailure("not_configured", "Falta configurar la cuenta de Keygen.");
  const url = `https://api.keygen.sh/v1/accounts/${encodeURIComponent(account)}/licenses/actions/validate-key`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        meta: {
          key: input.key,
        },
      }),
    });
  } catch {
    throw new KeygenFailure("unavailable", "Keygen no respondió. Intenta de nuevo en unos minutos.");
  }
  const payload = await response.json().catch(() => ({})) as { meta?: { valid?: unknown }; data?: KeygenResource | KeygenResource[] };
  if (!response.ok) throw new KeygenFailure("unavailable", "Keygen no pudo verificar la licencia.");
  const match = Array.isArray(payload.data) ? payload.data[0] : payload.data;
  const attrs = match?.attributes ?? {};
  const keyIsValid = payload.meta?.valid === true || (Boolean(match) && String(attrs.key ?? "") === input.key);
  if (!keyIsValid || !match) return { valid: false, reason: "INVALID_LICENSE" as const };

  // Keygen returns the license resource here; its name is the panel username.
  const normalizedName = input.username?.trim().toLocaleLowerCase();
  if (normalizedName && String(attrs.name ?? "").trim().toLocaleLowerCase() !== normalizedName) return { valid: false, reason: "USERNAME_MISMATCH" as const };
  const rawStatus = String(attrs.status ?? "").toUpperCase();
  const expiry = typeof attrs.expiry === "string" ? new Date(attrs.expiry) : null;
  const expired = Boolean(expiry && Number.isFinite(expiry.getTime()) && expiry.getTime() <= Date.now()) || rawStatus === "EXPIRED";
  if (Boolean(attrs.suspended) || rawStatus === "SUSPENDED" || expired) return { valid: false, reason: "INACTIVE_LICENSE" as const };
  return {
    valid: true,
    license: {
      id: match.id,
      name: String(attrs.name ?? input.username ?? ""),
      productId: relationshipId(match, "product"),
      expires: typeof attrs.expiry === "string" ? attrs.expiry : null,
    },
  };
}

export async function checkOutKeygenMachine(input: { licenseId: string; fingerprint: string; name: string; platform: string }) {
  const result = await keygenRequest<KeygenDocument>("/machines", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "machines",
        attributes: { fingerprint: input.fingerprint, name: input.name, platform: input.platform },
        relationships: { license: { data: { type: "licenses", id: input.licenseId } } },
      },
    }),
  });
  const machine = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!machine) throw new KeygenFailure("unavailable", "Keygen no devolvió la activación de la máquina.");
  return { id: machine.id, name: String(machine.attributes?.name ?? input.name) };
}

export async function heartbeatKeygenMachine(id: string) {
  await keygenRequest<KeygenDocument>(`/machines/${encodeURIComponent(id)}/actions/ping`, { method: "POST" });
  return { ok: true };
}

export async function checkKeygenConnection() {
  try {
    const result = await keygenRequest<KeygenDocument>("/products?limit=1");
    return { configured: true, connected: true, productCountPreview: collection(result).length };
  } catch (error) {
    const failure = error instanceof KeygenFailure ? error : new KeygenFailure("unavailable", "No fue posible verificar Keygen.");
    return {
      configured: failure.kind !== "not_configured",
      connected: false,
      issue: failure.kind,
      message: failure.message,
    };
  }
}

export async function listKeygenProducts() {
  const result = await keygenRequest<KeygenDocument>("/products?limit=100");
  return collection(result);
}

export async function listKeygenPolicies(productId?: string) {
  const query = productId ? `?limit=100&filter[product]=${encodeURIComponent(productId)}` : "?limit=100";
  const result = await keygenRequest<KeygenDocument>(`/policies${query}`);
  return collection(result);
}

export async function listKeygenLicenses(): Promise<KeygenLicenseSummary[]> {
  const result = await keygenRequest<KeygenDocument>("/licenses?limit=100&include=product,policy");
  const included = Array.isArray(result.included) ? result.included : [];
  const names = new Map(included.map((item) => [item.id, String(item.attributes?.name ?? item.attributes?.code ?? "")]));
  return collection(result).map((resource) => {
    const attrs = resource.attributes ?? {};
    const productId = relationshipId(resource, "product");
    const policyId = relationshipId(resource, "policy");
    // The full Keygen key is intentionally never included in list responses to the browser.
    const safeAttributes: Record<string, unknown> = {
      name: attrs.name ?? null,
      expiry: attrs.expiry ?? null,
      status: attrs.status ?? "UNKNOWN",
      suspended: Boolean(attrs.suspended),
      maxMachines: attrs.maxMachines ?? null,
      machineCount: attrs.machineCount ?? 0,
      uses: attrs.uses ?? 0,
      maxUses: attrs.maxUses ?? null,
    };
    return {
      id: resource.id,
      type: "licenses",
      attributes: safeAttributes,
      relationships: resource.relationships,
      maskedKey: maskedLicenseKey(attrs.key),
      productId,
      productName: productId ? names.get(productId) ?? "" : "",
      policyId,
    };
  });
}

export async function getKeygenLicenseDetails(id: string): Promise<KeygenLicenseDetails> {
  const result = await keygenRequest<KeygenDocument>(`/licenses/${encodeURIComponent(id)}?include=product,policy`);
  const resource = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!resource) throw new KeygenFailure("unavailable", "Keygen no devolvió los detalles de esta licencia.");
  const attrs = resource.attributes ?? {};
  const included = Array.isArray(result.included) ? result.included : [];
  const names = new Map(included.map((item) => [item.id, String(item.attributes?.name ?? item.attributes?.code ?? "")]));
  const productId = relationshipId(resource, "product");
  const policyId = relationshipId(resource, "policy");
  const permissions = Array.isArray(attrs.permissions)
    ? attrs.permissions.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: resource.id,
    name: typeof attrs.name === "string" ? attrs.name : "",
    expiry: typeof attrs.expiry === "string" ? attrs.expiry : null,
    status: String(attrs.status ?? "UNKNOWN"),
    uses: numericOrNull(attrs.uses) ?? 0,
    protected: Boolean(attrs.protected),
    suspended: Boolean(attrs.suspended),
    maxMachines: numericOrNull(attrs.maxMachines),
    maxProcesses: numericOrNull(attrs.maxProcesses),
    maxUsers: numericOrNull(attrs.maxUsers),
    maxCores: numericOrNull(attrs.maxCores),
    maxMemory: numericOrNull(attrs.maxMemory),
    maxDisk: numericOrNull(attrs.maxDisk),
    maxUses: numericOrNull(attrs.maxUses),
    permissions,
    metadata: metadataObject(attrs.metadata),
    productId,
    productName: productId ? names.get(productId) ?? "" : "",
    policyId,
    policyName: policyId ? names.get(policyId) ?? "" : "",
    ownerId: relationshipId(resource, "owner"),
    groupId: relationshipId(resource, "group"),
    maskedKey: maskedLicenseKey(attrs.key),
  };
}

export async function listKeygenMachines() {
  const result = await keygenRequest<KeygenDocument>("/machines?limit=100&include=license,product");
  const included = Array.isArray(result.included) ? result.included : [];
  const names = new Map(included.map((item) => [item.id, String(item.attributes?.name ?? item.attributes?.code ?? "")]));
  return collection(result).map((resource) => {
    const attrs = resource.attributes ?? {};
    const licenseId = resource.relationships?.license?.data?.id ?? "";
    const productId = resource.relationships?.product?.data?.id ?? "";
    const fingerprint = typeof attrs.fingerprint === "string" ? attrs.fingerprint : "";
    return {
      id: resource.id,
      name: String(attrs.name ?? "Equipo sin nombre"),
      platform: String(attrs.platform ?? "Plataforma no especificada"),
      fingerprint: fingerprint.length > 10 ? `${fingerprint.slice(0, 4)}••••${fingerprint.slice(-4)}` : "Huella protegida",
      licenseId,
      licenseName: names.get(licenseId) || "Licencia vinculada",
      productName: names.get(productId) || "Producto vinculado",
      heartbeatStatus: String(attrs.heartbeatStatus ?? "UNKNOWN"),
      requireHeartbeat: Boolean(attrs.requireHeartbeat),
      lastHeartbeat: typeof attrs.lastHeartbeat === "string" ? attrs.lastHeartbeat : null,
      created: typeof attrs.created === "string" ? attrs.created : null,
    };
  });
}

export async function deactivateKeygenMachine(id: string) {
  await keygenRequest<KeygenDocument>(`/machines/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listKeygenEventLogs(): Promise<KeygenAuditEvent[]> {
  const result = await keygenRequest<KeygenDocument>("/event-logs?limit=100");
  return collection(result).map((resource) => {
    const attrs = resource.attributes ?? {};
    const relatedResource = resource.relationships?.resource?.data;
    const actor = resource.relationships?.whodunnit?.data;
    const relatedId = relatedResource?.id ?? "";
    return {
      id: resource.id,
      event: String(attrs.event ?? "system.event"),
      created: typeof attrs.created === "string" ? attrs.created : null,
      resourceType: relatedResource?.type ?? "account",
      resourceId: relatedId ? `…${relatedId.slice(-6)}` : "",
      actorType: actor?.type ?? "system",
    };
  });
}

export async function createKeygenProduct(input: {
  name: string;
  code: string;
  url?: string;
  platforms?: string[];
  distributionStrategy?: "LICENSED" | "OPEN" | "CLOSED";
}) {
  const result = await keygenRequest<KeygenDocument>("/products", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "products",
        attributes: {
          name: input.name,
          code: input.code,
          ...(input.url ? { url: input.url } : {}),
          ...(input.platforms?.length ? { platforms: input.platforms } : {}),
          distributionStrategy: input.distributionStrategy ?? "LICENSED",
        },
      },
    }),
  });
  return result.data;
}

export async function updateKeygenProduct(input: {
  id: string;
  name: string;
  code: string;
  url?: string;
  platforms: string[];
  distributionStrategy: "LICENSED" | "OPEN" | "CLOSED";
}) {
  const result = await keygenRequest<KeygenDocument>(`/products/${encodeURIComponent(input.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "products",
        attributes: {
          name: input.name,
          code: input.code,
          ...(input.url ? { url: input.url } : {}),
          platforms: input.platforms,
          distributionStrategy: input.distributionStrategy,
        },
      },
    }),
  });
  return result.data;
}

export async function createKeygenLicense(input: {
  name: string;
  policyId: string;
  maxMachines?: number;
  maxUses?: number;
  expiry?: string | null;
  reference?: string;
}): Promise<{ id: string; name: string; key: string; maskedKey: string }> {
  const result = await keygenRequest<KeygenDocument>("/licenses", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "licenses",
        attributes: {
          name: input.name,
          ...(input.maxMachines ? { maxMachines: input.maxMachines } : {}),
          ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
          ...(input.expiry !== undefined ? { expiry: input.expiry } : {}),
          ...(input.reference?.trim() ? { metadata: { reference: input.reference.trim() } } : {}),
        },
        relationships: {
          policy: { data: { type: "policies", id: input.policyId } },
        },
      },
    }),
  });
  const resource = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!resource) throw new KeygenFailure("unavailable", "Keygen no devolvió la licencia recién creada.");
  const attrs = resource.attributes ?? {};
  const key = typeof attrs.key === "string" ? attrs.key : "";
  if (!key) throw new KeygenFailure("unavailable", "Keygen no devolvió la clave de una sola lectura; verifica el recurso antes de volver a generarlo.");
  return {
    id: resource.id,
    name: typeof attrs.name === "string" ? attrs.name : input.name,
    key,
    maskedKey: maskedLicenseKey(key),
  };
}

export async function updateKeygenLicense(id: string, attributes: KeygenLicenseEditableAttributes) {
  const result = await keygenRequest<KeygenDocument>(`/licenses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ data: { type: "licenses", attributes } }),
  });
  return result.data;
}

export async function changeKeygenLicensePolicy(id: string, policyId: string) {
  const result = await keygenRequest<KeygenDocument>(`/licenses/${encodeURIComponent(id)}/policy`, {
    method: "PUT",
    body: JSON.stringify({ data: { type: "policies", id: policyId } }),
  });
  return result.data;
}

export async function setKeygenLicenseUsage(id: string, action: "increment" | "decrement" | "reset", amount = 1) {
  const actionName = action === "reset" ? "reset-usage" : `${action}-usage`;
  const body = action === "increment"
    ? { meta: { increment: amount } }
    : action === "decrement"
      ? { meta: { decrement: amount } }
      : undefined;
  await keygenRequest<KeygenDocument>(`/licenses/${encodeURIComponent(id)}/actions/${actionName}`, {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function setKeygenLicenseSuspended(id: string, suspended: boolean) {
  const action = suspended ? "suspend" : "reinstate";
  const result = await keygenRequest<KeygenDocument>(`/licenses/${encodeURIComponent(id)}/actions/${action}`, {
    method: "POST",
  });
  return result.data;
}

export async function createKeygenPolicy(input: {
  name: string;
  productId: string;
  durationSeconds: number | null;
  maxMachines: number | null;
  maxUses: number | null;
  floating: boolean;
  strict: boolean;
  requireHeartbeat: boolean;
  requireCheckIn: boolean;
  checkInInterval: "day" | "week" | "month" | "year";
  checkInIntervalCount: number;
  authenticationStrategy: "TOKEN" | "LICENSE" | "MIXED" | "NONE";
  expirationBasis: "FROM_CREATION" | "FROM_FIRST_VALIDATION" | "FROM_FIRST_ACTIVATION";
  scheme: "ED25519_SIGN" | null;
}) {
  const attributes = {
    name: input.name,
    floating: input.floating,
    strict: input.strict,
    requireHeartbeat: input.requireHeartbeat,
    requireCheckIn: input.requireCheckIn,
    ...(input.requireCheckIn ? { checkInInterval: input.checkInInterval, checkInIntervalCount: input.checkInIntervalCount } : {}),
    authenticationStrategy: input.authenticationStrategy,
    expirationBasis: input.expirationBasis,
    ...(input.durationSeconds === null ? {} : { duration: input.durationSeconds }),
    ...(input.maxMachines === null ? {} : { maxMachines: input.maxMachines }),
    ...(input.maxUses === null ? {} : { maxUses: input.maxUses }),
    ...(input.scheme ? { scheme: input.scheme } : {}),
  };
  const result = await keygenRequest<KeygenDocument>("/policies", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "policies",
        attributes,
        relationships: { product: { data: { type: "products", id: input.productId } } },
      },
    }),
  });
  return result.data;
}

export async function listKeygenProductTokens(productId: string): Promise<KeygenProductTokenSummary[]> {
  const result = await keygenRequest<KeygenDocument>(
    `/products/${encodeURIComponent(productId)}/tokens?limit=100`,
  );
  return collection(result).map((resource) => {
    const attrs = resource.attributes ?? {};
    return {
      id: resource.id,
      name: typeof attrs.name === "string" ? attrs.name : "Token de producto",
      kind: typeof attrs.kind === "string" ? attrs.kind : "product-token",
      permissions: Array.isArray(attrs.permissions)
        ? attrs.permissions.filter((value): value is string => typeof value === "string")
        : [],
      created: typeof attrs.created === "string" ? attrs.created : null,
    };
  });
}

export async function createKeygenProductToken(input: {
  productId: string;
  name: string;
  permissions: string[];
  expiry?: string;
}): Promise<KeygenCreatedProductToken> {
  const result = await keygenRequest<KeygenDocument>(
    `/products/${encodeURIComponent(input.productId)}/tokens`,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "tokens",
          attributes: {
            name: input.name,
            permissions: input.permissions,
            ...(input.expiry ? { expiry: input.expiry } : {}),
          },
        },
      }),
    },
  );
  const resource = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!resource) throw new KeygenFailure("unavailable", "Keygen no devolvió el token recién creado.");
  const attrs = resource.attributes ?? {};
  const secret = typeof attrs.token === "string" ? attrs.token : "";
  if (!secret) throw new KeygenFailure("unavailable", "Keygen no devolvió el secreto de una sola lectura; verifica el recurso antes de volver a generarlo.");
  return {
    id: resource.id,
    name: typeof attrs.name === "string" ? attrs.name : input.name,
    kind: typeof attrs.kind === "string" ? attrs.kind : "product-token",
    permissions: Array.isArray(attrs.permissions)
      ? attrs.permissions.filter((value): value is string => typeof value === "string")
      : input.permissions,
    created: typeof attrs.created === "string" ? attrs.created : null,
    secret,
  };
}

export async function revokeKeygenToken(id: string) {
  await keygenRequest<KeygenDocument>(`/tokens/${encodeURIComponent(id)}`, { method: "DELETE" });
}
